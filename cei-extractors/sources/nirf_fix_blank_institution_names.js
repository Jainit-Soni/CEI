const fs = require("fs");
const path = require("path");

let MongoClient;
try {
  ({ MongoClient } = require("mongodb"));
} catch (err) {
  console.error("Missing dependency: mongodb. Install it with: npm install mongodb");
  process.exit(1);
}

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "cei-extractors", "output");
const PARSED_DIR = path.join(OUTPUT_DIR, "parsed");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const CEI_DB_NAME = process.env.CEI_DB_NAME || "cei_v2";
const RANKINGS_COLLECTION = process.env.CEI_RANKINGS_COLLECTION || "rankings";

const DRY_RUN = String(process.env.DRY_RUN || "true").toLowerCase() === "true";
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 500);
const SAMPLE_LIMIT = Number(process.env.SAMPLE_LIMIT || 10);

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildStableImportKey(doc) {
  return [
    "nirf_ranking",
    clean(doc.ranking_year),
    clean(doc.category),
    clean(doc.rank),
    clean(doc.institution_name),
    clean(doc.city),
    clean(doc.state_name),
  ].join("::");
}

function extractInstitutionName(doc) {
  const row = doc.original_row || {};

  const candidates = [
    doc.institution_name,
    row.instituteName,
    row.institutionName,
    row.institute_name,
    row.institution_name,
    row.name,
    row.collegeName,
    row.college_name,
    row.universityName,
    row.university_name,
  ].map(clean);

  return candidates.find(Boolean) || "";
}

function extractNirfId(doc) {
  const row = doc.original_row || {};
  const candidates = [
    doc.nirf_id,
    row.instituteId,
    row.institute_id,
    row.nirfId,
    row.id,
  ].map(clean);

  return candidates.find(Boolean) || "";
}

async function ensureIndexes(db) {
  await db.collection(RANKINGS_COLLECTION).createIndex(
    { stable_import_key: 1 },
    { unique: true, name: "uniq_stable_import_key" }
  );

  await db.collection(RANKINGS_COLLECTION).createIndex(
    { source: 1, ranking_year: 1, category: 1, rank: 1 },
    { name: "idx_source_year_category_rank" }
  );
}

async function main() {
  ensureDir(PARSED_DIR);

  console.log("Mongo URI         :", MONGO_URI);
  console.log("CEI DB            :", CEI_DB_NAME);
  console.log("Collection        :", RANKINGS_COLLECTION);
  console.log("Dry run           :", DRY_RUN);
  console.log("Batch size        :", BATCH_SIZE);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(CEI_DB_NAME);
    await ensureIndexes(db);

    const collection = db.collection(RANKINGS_COLLECTION);

    const targetQuery = {
      source: "nirf",
      $or: [
        { institution_name: { $exists: false } },
        { institution_name: "" },
        { institution_name: null },
      ],
    };

    const docs = await collection.find(targetQuery).toArray();

    const stats = {
      scanned_blank_name_docs: docs.length,
      fixable_docs: 0,
      unfixable_docs: 0,
      nirf_id_filled: 0,
      stable_key_changed: 0,
      updated_docs: 0,
      failed_docs: 0,
      samples_fixed: [],
      samples_unfixable: [],
    };

    if (!docs.length) {
      const emptyReportPath = path.join(
        PARSED_DIR,
        `nirf_fix_blank_institution_names_report_${new Date().toISOString().replace(/[:.]/g, "-")}.json`
      );

      writeJson(emptyReportPath, {
        generated_at: new Date().toISOString(),
        db: { uri: MONGO_URI, name: CEI_DB_NAME, collection: RANKINGS_COLLECTION },
        dry_run: DRY_RUN,
        stats,
        note: "No blank NIRF institution_name rows found.",
      });

      console.log("\nNIRF FIX COMPLETE");
      console.log("Blank-name docs    : 0");
      console.log("Report             :", emptyReportPath);
      return;
    }

    const prepared = [];

    for (const doc of docs) {
      const fixedInstitutionName = extractInstitutionName(doc);
      const fixedNirfId = extractNirfId(doc);

      if (!fixedInstitutionName) {
        stats.unfixable_docs += 1;

        if (stats.samples_unfixable.length < SAMPLE_LIMIT) {
          stats.samples_unfixable.push({
            _id: String(doc._id),
            rank: doc.rank,
            category: doc.category,
            city: doc.city,
            state_name: doc.state_name,
            current_institution_name: doc.institution_name,
            original_row: doc.original_row || null,
          });
        }
        continue;
      }

      const nextDoc = {
        ...doc,
        institution_name: fixedInstitutionName,
        nirf_id: fixedNirfId || clean(doc.nirf_id),
        fixed_at: new Date().toISOString(),
        fix_script: "nirf_fix_blank_institution_names.js",
      };

      const newStableKey = buildStableImportKey(nextDoc);
      const oldStableKey = clean(doc.stable_import_key);

      if (newStableKey !== oldStableKey) {
        nextDoc.stable_import_key = newStableKey;
        stats.stable_key_changed += 1;
      }

      if (fixedNirfId && !clean(doc.nirf_id)) {
        stats.nirf_id_filled += 1;
      }

      stats.fixable_docs += 1;

      if (stats.samples_fixed.length < SAMPLE_LIMIT) {
        stats.samples_fixed.push({
          _id: String(doc._id),
          old_institution_name: clean(doc.institution_name),
          new_institution_name: fixedInstitutionName,
          old_stable_import_key: oldStableKey,
          new_stable_import_key: newStableKey,
          old_nirf_id: clean(doc.nirf_id),
          new_nirf_id: clean(nextDoc.nirf_id),
          original_row: doc.original_row || null,
        });
      }

      prepared.push({
        _id: doc._id,
        nextDoc,
      });
    }

    const batches = chunkArray(prepared, BATCH_SIZE);

    for (const batch of batches) {
      const ops = batch.map(({ _id, nextDoc }) => ({
        replaceOne: {
          filter: { _id },
          replacement: nextDoc,
        },
      }));

      if (!ops.length) continue;

      if (DRY_RUN) {
        stats.updated_docs += ops.length;
        continue;
      }

      try {
        const res = await collection.bulkWrite(ops, { ordered: false });
        stats.updated_docs += res.modifiedCount || 0;
      } catch (err) {
        stats.failed_docs += ops.length;
        console.error("Batch write failed:", String(err));
      }
    }

    const postRemaining = await collection.countDocuments(targetQuery);

    const report = {
      generated_at: new Date().toISOString(),
      db: {
        uri: MONGO_URI,
        name: CEI_DB_NAME,
        collection: RANKINGS_COLLECTION,
      },
      dry_run: DRY_RUN,
      stats: {
        ...stats,
        remaining_blank_name_docs_after_run: DRY_RUN
          ? docs.length
          : postRemaining,
      },
    };

    const reportPath = path.join(
      PARSED_DIR,
      `nirf_fix_blank_institution_names_report_${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );
    writeJson(reportPath, report);

    console.log("\nNIRF FIX COMPLETE");
    console.log("Blank-name docs    :", stats.scanned_blank_name_docs);
    console.log("Fixable docs       :", stats.fixable_docs);
    console.log("Unfixable docs     :", stats.unfixable_docs);
    console.log("Stable key changed :", stats.stable_key_changed);
    console.log("NIRF ID filled     :", stats.nirf_id_filled);
    console.log("Updated docs       :", stats.updated_docs);
    console.log("Failed docs        :", stats.failed_docs);
    console.log(
      "Remaining blanks   :",
      DRY_RUN ? stats.scanned_blank_name_docs : postRemaining
    );
    console.log("Report             :", reportPath);
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("NIRF FIX FAILED");
  console.error(err);
  process.exit(1);
});