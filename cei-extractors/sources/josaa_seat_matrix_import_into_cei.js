const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'cei_v2';
const COLLECTION_NAME = 'seat_matrix';

const INPUT_FILE = path.join(__dirname, 'output', 'josaa_seat_matrix_all_normalized.ndjson');
const AUDIT_FILE = path.join(__dirname, 'output', 'josaa_seat_matrix_audit_report.json');

const REQUIRED_FIELDS = [
  'authority',
  'source_type',
  'academic_year',
  'counselling_year',
  'institute_name_normalized',
  'program_name_raw',
  'quota_scope_canonical',
  'seat_pool_canonical',
  'entity_key',
  'source_row_fingerprint',
  'source_url',
  'provenance'
];

const NUMERIC_FIELDS = [
  'open',
  'open_pwd',
  'gen_ews',
  'gen_ews_pwd',
  'sc',
  'sc_pwd',
  'st',
  'st_pwd',
  'obc_ncl',
  'obc_ncl_pwd',
  'total_includes_female_supernumerary',
  'category_sum_excluding_program_totals',
  'program_total_seat_capacity',
  'program_total_female_supernumerary'
];

const BATCH_SIZE = 1000;

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function isValidNumber(v) {
  return Number.isFinite(Number(v));
}

function validateDoc(doc) {
  const missingFields = REQUIRED_FIELDS.filter((field) => {
    if (field === 'provenance') return !doc.provenance || typeof doc.provenance !== 'object';
    return isBlank(doc[field]);
  });

  const invalidNumericFields = NUMERIC_FIELDS.filter((field) => !isValidNumber(doc[field]));

  return {
    ok: missingFields.length === 0 && invalidNumericFields.length === 0,
    missingFields,
    invalidNumericFields
  };
}

async function flushBatch(collection, ops) {
  if (ops.length === 0) {
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
  }

  const res = await collection.bulkWrite(ops, { ordered: false });

  return {
    matchedCount: res.matchedCount || 0,
    modifiedCount: res.modifiedCount || 0,
    upsertedCount: res.upsertedCount || 0
  };
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`INPUT FILE NOT FOUND: ${INPUT_FILE}`);
    process.exit(1);
  }

  if (!fs.existsSync(AUDIT_FILE)) {
    console.error(`AUDIT FILE NOT FOUND: ${AUDIT_FILE}`);
    console.error('Run audit first: node josaa_seat_matrix_audit.js');
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

    await collection.createIndex({ entity_key: 1 }, { unique: true, name: 'uq_entity_key' });
    await collection.createIndex({ authority: 1, counselling_year: 1 }, { name: 'authority_year' });
    await collection.createIndex({ institute_name_normalized: 1 }, { name: 'institute_name_normalized' });
    await collection.createIndex({ program_title: 1 }, { name: 'program_title' });
    await collection.createIndex({ quota_scope_canonical: 1, seat_pool_canonical: 1 }, { name: 'quota_pool' });
    await collection.createIndex({ source_row_fingerprint: 1 }, { name: 'source_row_fingerprint' });

    const rl = readline.createInterface({
      input: fs.createReadStream(INPUT_FILE, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });

    let rowsRead = 0;
    let rowsSkippedBlank = 0;
    let rowsSkippedParseError = 0;
    let rowsSkippedValidation = 0;
    let rowsMismatchFlagTrue = 0;

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

      if (doc.total_mismatch_flag === true) {
        rowsMismatchFlagTrue += 1;
      }

      ops.push({
        updateOne: {
          filter: { entity_key: doc.entity_key },
          update: { $set: doc },
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
    }

    if (ops.length > 0) {
      const res = await flushBatch(collection, ops);
      matchedTotal += res.matchedCount;
      modifiedTotal += res.modifiedCount;
      upsertedTotal += res.upsertedCount;
    }

    const finalCount = await collection.countDocuments({});
    const mismatchCountInDb = await collection.countDocuments({ total_mismatch_flag: true });

    console.log('\nJOSAA SEAT MATRIX IMPORT COMPLETE');
    console.log('Mongo URI                         :', MONGO_URI);
    console.log('Database                          :', DB_NAME);
    console.log('Collection                        :', COLLECTION_NAME);
    console.log('Input file                        :', INPUT_FILE);
    console.log('Audit file                        :', AUDIT_FILE);
    console.log('Rows read                         :', rowsRead);
    console.log('Rows skipped blank                :', rowsSkippedBlank);
    console.log('Rows skipped parse error          :', rowsSkippedParseError);
    console.log('Rows skipped validation           :', rowsSkippedValidation);
    console.log('Rows with total_mismatch_flag=true:', rowsMismatchFlagTrue);
    console.log('Matched existing docs             :', matchedTotal);
    console.log('Modified existing docs            :', modifiedTotal);
    console.log('Upserted new docs                 :', upsertedTotal);
    console.log('Final collection count            :', finalCount);
    console.log('Mismatch rows in DB               :', mismatchCountInDb);

    if (invalidSamples.length > 0) {
      console.log('\nValidation skip samples:');
      console.log(JSON.stringify(invalidSamples, null, 2));
    }

    process.exit(rowsSkippedParseError === 0 && rowsSkippedValidation === 0 ? 0 : 2);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('IMPORT FAILED:', err);
  process.exit(1);
});