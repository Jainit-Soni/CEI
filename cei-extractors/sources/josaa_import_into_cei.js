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

const CUTOFFS_COLLECTION =
  process.env.CEI_CUTOFFS_COLLECTION || "engineering_cutoffs";
const SOURCE_REGISTRY_COLLECTION =
  process.env.CEI_SOURCE_REGISTRY_COLLECTION || "source_registry";
const PACKAGE_REGISTRY_COLLECTION =
  process.env.CEI_PACKAGE_REGISTRY_COLLECTION || "data_packages";
const COVERAGE_REPORTS_COLLECTION =
  process.env.CEI_COVERAGE_REPORTS_COLLECTION || "coverage_reports";

const DRY_RUN = String(process.env.DRY_RUN || "false").toLowerCase() === "true";
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 500);

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function listDir(dirPath) {
  return fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : [];
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function getLatestPackageManifestPath() {
  const explicit =
    clean(process.env.JOSAA_PACKAGE_MANIFEST) ||
    clean(process.env.PACKAGE_MANIFEST);

  if (explicit) {
    if (!fs.existsSync(explicit)) {
      throw new Error(`Package manifest not found: ${explicit}`);
    }
    return explicit;
  }

  const dirs = listDir(PARSED_DIR)
    .filter((name) => name.startsWith("josaa_cei_package_"))
    .sort();

  if (!dirs.length) {
    throw new Error("No josaa_cei_package_* directory found in parsed output.");
  }

  const latestDir = path.join(PARSED_DIR, dirs[dirs.length - 1]);
  const manifestPath = path.join(latestDir, "josaa_package_manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Package manifest not found: ${manifestPath}`);
  }

  return manifestPath;
}

function validatePackageManifest(manifest) {
  const required = ["package_id", "package_dir", "outputs"];
  for (const key of required) {
    if (!(key in manifest)) {
      throw new Error(`Package manifest missing key: ${key}`);
    }
  }

  const outputKeys = [
    "cutoffs_json",
    "source_registry_json",
    "coverage_summary_json",
  ];

  for (const key of outputKeys) {
    const filePath = manifest.outputs[key];
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Package output missing or not found: ${key} -> ${filePath}`);
    }
  }
}

function enrichDocs(docs, packageMeta) {
  const importedAt = new Date().toISOString();

  return docs.map((doc) => ({
    ...doc,
    source_package_id: packageMeta.package_id,
    source_package_dir: packageMeta.package_dir,
    source_package_manifest_path: packageMeta.manifest_path,
    imported_at: importedAt,
  }));
}

async function ensureIndexes(db) {
  await db.collection(CUTOFFS_COLLECTION).createIndex(
    { stable_import_key: 1 },
    { unique: true, name: "uniq_stable_import_key" }
  );

  await db.collection(CUTOFFS_COLLECTION).createIndex(
    { source: 1, counselling_year: 1, round_number: 1 },
    { name: "idx_source_year_round" }
  );

  await db.collection(CUTOFFS_COLLECTION).createIndex(
    { institute_name_normalized: 1, program_name_raw: 1 },
    { name: "idx_institute_program" }
  );

  await db.collection(CUTOFFS_COLLECTION).createIndex(
    { quota_code: 1, local_category_label: 1, gender_pool_raw: 1 },
    { name: "idx_quota_category_gender" }
  );

  await db.collection(SOURCE_REGISTRY_COLLECTION).createIndex(
    { source_id: 1 },
    { unique: true, name: "uniq_source_id" }
  );

  await db.collection(PACKAGE_REGISTRY_COLLECTION).createIndex(
    { package_id: 1 },
    { unique: true, name: "uniq_package_id" }
  );

  await db.collection(COVERAGE_REPORTS_COLLECTION).createIndex(
    { package_id: 1 },
    { unique: true, name: "uniq_package_id" }
  );
}

async function upsertDocuments({
  collection,
  docs,
  keyField,
  batchSize,
  dryRun,
}) {
  const stats = {
    collection: collection.collectionName,
    totalDocs: docs.length,
    batches: 0,
    wouldInsert: 0,
    wouldUpdate: 0,
    inserted: 0,
    updated: 0,
    matched: 0,
    modified: 0,
    upserted: 0,
  };

  const batches = chunkArray(docs, batchSize);

  for (const batch of batches) {
    stats.batches += 1;

    const keys = batch
      .map((doc) => clean(doc[keyField]))
      .filter(Boolean);

    const existingRows = await collection
      .find(
        { [keyField]: { $in: keys } },
        { projection: { [keyField]: 1 } }
      )
      .toArray();

    const existingSet = new Set(
      existingRows.map((row) => clean(row[keyField])).filter(Boolean)
    );

    let batchWouldInsert = 0;
    let batchWouldUpdate = 0;

    for (const doc of batch) {
      const key = clean(doc[keyField]);
      if (!key) continue;

      if (existingSet.has(key)) batchWouldUpdate += 1;
      else batchWouldInsert += 1;
    }

    stats.wouldInsert += batchWouldInsert;
    stats.wouldUpdate += batchWouldUpdate;

    if (dryRun) continue;

    const ops = [];
    for (const doc of batch) {
      const key = clean(doc[keyField]);
      if (!key) continue;

      ops.push({
        updateOne: {
          filter: { [keyField]: doc[keyField] },
          update: {
            $set: doc,
            $setOnInsert: {
              created_at: new Date().toISOString(),
            },
          },
          upsert: true,
        },
      });
    }

    if (!ops.length) continue;

    const res = await collection.bulkWrite(ops, { ordered: false });

    stats.inserted += res.upsertedCount || 0;
    stats.upserted += res.upsertedCount || 0;
    stats.matched += res.matchedCount || 0;
    stats.modified += res.modifiedCount || 0;
    stats.updated += batchWouldUpdate;
  }

  return stats;
}

async function upsertSmallRegistryDoc({
  collection,
  filter,
  doc,
  dryRun,
}) {
  if (dryRun) {
    return {
      collection: collection.collectionName,
      dryRun: true,
      filter,
    };
  }

  const res = await collection.updateOne(
    filter,
    {
      $set: doc,
      $setOnInsert: {
        created_at: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  return {
    collection: collection.collectionName,
    matchedCount: res.matchedCount || 0,
    modifiedCount: res.modifiedCount || 0,
    upsertedCount: res.upsertedCount || 0,
  };
}

async function main() {
  const packageManifestPath = getLatestPackageManifestPath();
  const packageManifest = readJson(packageManifestPath);
  validatePackageManifest(packageManifest);

  const packageMeta = {
    package_id: clean(packageManifest.package_id),
    package_dir: clean(packageManifest.package_dir),
    manifest_path: packageManifestPath,
  };

  const cutoffsInput = readJson(packageManifest.outputs.cutoffs_json);
  const sourceRegistryInput = readJson(packageManifest.outputs.source_registry_json);
  const coverageSummaryInput = readJson(packageManifest.outputs.coverage_summary_json);

  console.log("Using package manifest :", packageManifestPath);
  console.log("Cutoffs input          :", packageManifest.outputs.cutoffs_json);
  console.log("Source registry input  :", packageManifest.outputs.source_registry_json);
  console.log("Coverage input         :", packageManifest.outputs.coverage_summary_json);
  console.log("Mongo URI              :", MONGO_URI);
  console.log("CEI DB                 :", CEI_DB_NAME);
  console.log("Cutoffs collection     :", CUTOFFS_COLLECTION);
  console.log("Dry run                :", DRY_RUN);
  console.log("Batch size             :", BATCH_SIZE);

  const cutoffs = enrichDocs(cutoffsInput, packageMeta);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(CEI_DB_NAME);

    await ensureIndexes(db);

    const cutoffStats = await upsertDocuments({
      collection: db.collection(CUTOFFS_COLLECTION),
      docs: cutoffs,
      keyField: "stable_import_key",
      batchSize: BATCH_SIZE,
      dryRun: DRY_RUN,
    });

    const registryResults = [];
    for (const row of sourceRegistryInput) {
      registryResults.push(
        await upsertSmallRegistryDoc({
          collection: db.collection(SOURCE_REGISTRY_COLLECTION),
          filter: { source_id: row.source_id },
          doc: {
            ...row,
            package_id: packageMeta.package_id,
            imported_at: new Date().toISOString(),
          },
          dryRun: DRY_RUN,
        })
      );
    }

    const packageRegistryResult = await upsertSmallRegistryDoc({
      collection: db.collection(PACKAGE_REGISTRY_COLLECTION),
      filter: { package_id: packageMeta.package_id },
      doc: {
        ...packageManifest,
        manifest_path: packageManifestPath,
        imported_at: new Date().toISOString(),
      },
      dryRun: DRY_RUN,
    });

    const coverageResult = await upsertSmallRegistryDoc({
      collection: db.collection(COVERAGE_REPORTS_COLLECTION),
      filter: { package_id: packageMeta.package_id },
      doc: {
        package_id: packageMeta.package_id,
        coverage: coverageSummaryInput,
        imported_at: new Date().toISOString(),
      },
      dryRun: DRY_RUN,
    });

    const report = {
      package: packageMeta,
      dryRun: DRY_RUN,
      db: {
        uri: MONGO_URI,
        name: CEI_DB_NAME,
      },
      collections: {
        cutoffs: CUTOFFS_COLLECTION,
        source_registry: SOURCE_REGISTRY_COLLECTION,
        data_packages: PACKAGE_REGISTRY_COLLECTION,
        coverage_reports: COVERAGE_REPORTS_COLLECTION,
      },
      stats: {
        cutoffs: cutoffStats,
        source_registry: registryResults,
        package_registry: packageRegistryResult,
        coverage_reports: coverageResult,
      },
    };

    const reportPath = path.join(
      packageMeta.package_dir,
      `josaa_import_report_${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );
    writeJson(reportPath, report);

    console.log("\nJOSAA IMPORT INTO CEI COMPLETE");
    console.log("Cutoffs total          :", cutoffStats.totalDocs);
    console.log(
      "Cutoffs would/add      :",
      DRY_RUN ? cutoffStats.wouldInsert : cutoffStats.inserted
    );
    console.log(
      "Cutoffs update         :",
      DRY_RUN ? cutoffStats.wouldUpdate : cutoffStats.updated
    );
    console.log("Import report          :", reportPath);
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("JOSAA IMPORT INTO CEI FAILED");
  console.error(err);
  process.exit(1);
});