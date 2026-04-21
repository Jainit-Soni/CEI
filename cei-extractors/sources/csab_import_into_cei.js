const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'cei_v2';
const COLLECTION_NAME = 'engineering_cutoffs';

const INPUT_FILE = path.join(__dirname, 'output', 'csab_orcr_all_rounds_normalized.ndjson');
const AUDIT_FILE = path.join(__dirname, 'output', 'csab_orcr_audit_report.json');

const BATCH_SIZE = 1000;
const PROGRESS_EVERY = 5000;

const REQUIRED_FIELDS = [
  'authority',
  'source_type',
  'counselling_variant',
  'academic_year',
  'counselling_year',
  'special_round',
  'institute_name_raw',
  'academic_program_name_raw',
  'quota_canonical',
  'seat_type_canonical',
  'gender_canonical',
  'opening_rank',
  'closing_rank',
  'opening_closing_inversion_flag',
  'source_url',
  'provenance',
  'entity_key',
  'source_row_fingerprint'
];

const NUMERIC_FIELDS = [
  'counselling_year',
  'special_round',
  'opening_rank',
  'closing_rank'
];

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function isValidNumber(v) {
  return Number.isFinite(Number(v));
}

function validateDoc(doc) {
  const missingFields = REQUIRED_FIELDS.filter((field) => {
    if (field === 'provenance') {
      return !doc.provenance || typeof doc.provenance !== 'object';
    }
    return isBlank(doc[field]);
  });

  const invalidNumericFields = NUMERIC_FIELDS.filter((field) => !isValidNumber(doc[field]));

  return {
    ok: missingFields.length === 0 && invalidNumericFields.length === 0,
    missingFields,
    invalidNumericFields
  };
}

function deriveStableImportKey(doc) {
  if (!isBlank(doc.stable_import_key)) {
    return String(doc.stable_import_key).trim();
  }
  if (!isBlank(doc.entity_key)) {
    return String(doc.entity_key).trim();
  }
  return '';
}

function summarizeBulkError(err) {
  const out = {
    message: err?.message || 'Unknown bulk write error',
    code: err?.code || null,
    duplicateKeyErrors: 0,
    sampleWriteErrors: []
  };

  const writeErrors = Array.isArray(err?.writeErrors) ? err.writeErrors : [];
  out.duplicateKeyErrors = writeErrors.filter((e) => e?.err?.code === 11000 || e?.code === 11000).length;

  for (const e of writeErrors.slice(0, 10)) {
    out.sampleWriteErrors.push({
      code: e?.err?.code || e?.code || null,
      errmsg: e?.err?.errmsg || e?.errmsg || null,
      opFilter: e?.err?.op?.q || e?.op?.q || null
    });
  }

  return out;
}

async function flushBatch(collection, ops) {
  if (ops.length === 0) {
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
  }

  try {
    const res = await collection.bulkWrite(ops, { ordered: false });
    return {
      matchedCount: res.matchedCount || 0,
      modifiedCount: res.modifiedCount || 0,
      upsertedCount: res.upsertedCount || 0
    };
  } catch (err) {
    const summary = summarizeBulkError(err);
    console.error('\nBULK WRITE FAILED');
    console.error(JSON.stringify(summary, null, 2));
    throw err;
  }
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`INPUT FILE NOT FOUND: ${INPUT_FILE}`);
    process.exit(1);
  }

  if (!fs.existsSync(AUDIT_FILE)) {
    console.error(`AUDIT FILE NOT FOUND: ${AUDIT_FILE}`);
    console.error('Run audit first: node csab_orcr_audit.js');
    process.exit(1);
  }

  const audit = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
  if (!audit.audit_ok_to_import) {
    console.error('AUDIT REPORT BLOCKS IMPORT.');
    console.error('Fix audit issues first. Report:', AUDIT_FILE);
    process.exit(2);
  }

  const client = new MongoClient(MONGO_URI);
  await client.connect();

  try {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    await collection.createIndex(
      { stable_import_key: 1 },
      { unique: true, name: 'uniq_stable_import_key' }
    );

    await collection.createIndex(
      { entity_key: 1 },
      { name: 'entity_key_lookup' }
    );

    await collection.createIndex(
      { authority: 1, counselling_year: 1 },
      { name: 'authority_year' }
    );

    await collection.createIndex(
      { counselling_variant: 1, special_round: 1 },
      { name: 'variant_round' }
    );

    const rl = readline.createInterface({
      input: fs.createReadStream(INPUT_FILE, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });

    let rowsRead = 0;
    let rowsSkippedBlank = 0;
    let rowsSkippedParseError = 0;
    let rowsSkippedValidation = 0;
    let rowsSkippedStableKey = 0;
    let rowsInversionFlagTrue = 0;

    let matchedTotal = 0;
    let modifiedTotal = 0;
    let upsertedTotal = 0;

    let ops = [];
    const invalidSamples = [];

    for await (const line of rl) {
      const raw = line.trim();

      if (!raw) {
        rowsSkippedBlank += 1;
        continue;
      }

      rowsRead += 1;

      let doc;
      try {
        doc = JSON.parse(raw);
      } catch (err) {
        rowsSkippedParseError += 1;
        if (invalidSamples.length < 10) {
          invalidSamples.push({
            row_number: rowsRead,
            reason: 'parse_error',
            error: err.message
          });
        }
        continue;
      }

      const validation = validateDoc(doc);
      if (!validation.ok) {
        rowsSkippedValidation += 1;
        if (invalidSamples.length < 10) {
          invalidSamples.push({
            row_number: rowsRead,
            entity_key: doc.entity_key || null,
            missing_fields: validation.missingFields,
            invalid_numeric_fields: validation.invalidNumericFields
          });
        }
        continue;
      }

      const stableImportKey = deriveStableImportKey(doc);
      if (isBlank(stableImportKey)) {
        rowsSkippedStableKey += 1;
        if (invalidSamples.length < 10) {
          invalidSamples.push({
            row_number: rowsRead,
            entity_key: doc.entity_key || null,
            reason: 'missing_stable_import_key_after_derivation'
          });
        }
        continue;
      }

      if (doc.opening_closing_inversion_flag === true) {
        rowsInversionFlagTrue += 1;
      }

      const docToWrite = {
        ...doc,
        stable_import_key: stableImportKey
      };

      ops.push({
        updateOne: {
          filter: { entity_key: docToWrite.entity_key },
          update: { $set: docToWrite },
          upsert: true
        }
      });

      if (ops.length >= BATCH_SIZE) {
        const res = await flushBatch(collection, ops);
        matchedTotal += res.matchedCount;
        modifiedTotal += res.modifiedCount;
        upsertedTotal += res.upsertedCount;
        ops = [];
      }

      if (rowsRead % PROGRESS_EVERY === 0) {
        console.log(
          `Progress: rowsRead=${rowsRead}, upserted=${upsertedTotal}, matched=${matchedTotal}, modified=${modifiedTotal}`
        );
      }
    }

    if (ops.length > 0) {
      const res = await flushBatch(collection, ops);
      matchedTotal += res.matchedCount;
      modifiedTotal += res.modifiedCount;
      upsertedTotal += res.upsertedCount;
    }

    const finalCount = await collection.countDocuments({});
    const csabCount = await collection.countDocuments({ authority: 'CSAB' });
    const josaaCount = await collection.countDocuments({ authority: 'JOSAA' });
    const nullStableImportKeyCount = await collection.countDocuments({ stable_import_key: null });

    console.log('\nCSAB IMPORT COMPLETE');
    console.log('Mongo URI                            :', MONGO_URI);
    console.log('Database                             :', DB_NAME);
    console.log('Collection                           :', COLLECTION_NAME);
    console.log('Input file                           :', INPUT_FILE);
    console.log('Audit file                           :', AUDIT_FILE);
    console.log('Rows read                            :', rowsRead);
    console.log('Rows skipped blank                   :', rowsSkippedBlank);
    console.log('Rows skipped parse error             :', rowsSkippedParseError);
    console.log('Rows skipped validation              :', rowsSkippedValidation);
    console.log('Rows skipped stable key              :', rowsSkippedStableKey);
    console.log('Rows with inversion flag true        :', rowsInversionFlagTrue);
    console.log('Matched existing docs                :', matchedTotal);
    console.log('Modified existing docs               :', modifiedTotal);
    console.log('Upserted new docs                    :', upsertedTotal);
    console.log('Final engineering_cutoffs count      :', finalCount);
    console.log('CSAB docs in engineering_cutoffs     :', csabCount);
    console.log('JOSAA docs in engineering_cutoffs    :', josaaCount);
    console.log('Null stable_import_key count         :', nullStableImportKeyCount);

    if (invalidSamples.length > 0) {
      console.log('\nValidation/skip samples:');
      console.log(JSON.stringify(invalidSamples, null, 2));
    }

    process.exit(
      rowsSkippedParseError === 0 &&
      rowsSkippedValidation === 0 &&
      rowsSkippedStableKey === 0
        ? 0
        : 2
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('IMPORT FAILED:', err);
  process.exit(1);
});