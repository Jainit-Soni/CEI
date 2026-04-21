const fs = require("fs");
const path = require("path");

let MongoClient;
try {
  ({ MongoClient } = require("mongodb"));
} catch (err) {
  console.error("Missing dependency: mongodb. Install it with: npm install mongodb");
  process.exit(1);
}

let EJSON;
try {
  ({ EJSON } = require("bson"));
} catch {
  EJSON = {
    stringify: (value) => JSON.stringify(value),
  };
}

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "cei-extractors", "output");
const PARSED_DIR = path.join(OUTPUT_DIR, "parsed");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const CEI_DB_NAME = process.env.CEI_DB_NAME || "cei_v2";

const SAMPLE_LIMIT = Number(process.env.SAMPLE_LIMIT || 5);
const CURSOR_BATCH_SIZE = Number(process.env.CURSOR_BATCH_SIZE || 1000);

const WRITE_EXPORTS = String(process.env.WRITE_EXPORTS || "true").toLowerCase() !== "false";
const DROP_COLLECTIONS = String(process.env.DROP_COLLECTIONS || "false").toLowerCase() === "true";
const DROP_APP_AFTER_EXPORT =
  String(process.env.DROP_APP_AFTER_EXPORT || "false").toLowerCase() === "true";
const DROP_EMPTY_AFTER_EXPORT =
  String(process.env.DROP_EMPTY_AFTER_EXPORT || "true").toLowerCase() === "true";
const DROP_LEGACY_AFTER_EXPORT =
  String(process.env.DROP_LEGACY_AFTER_EXPORT || "false").toLowerCase() === "true";

const CONFIRM_CLEANUP = String(process.env.CONFIRM_CLEANUP || "");

const REQUIRED_CONFIRM_TEXT = "YES_DELETE_NON_CORE";

const TARGET_PLAN = [
  {
    collection: "activitylogs",
    classification: "app_data",
    recommended_action: "MOVE_OUT_OF_CORE",
    note: "App analytics/logs. Not official source truth.",
  },
  {
    collection: "users",
    classification: "app_data",
    recommended_action: "MOVE_OUT_OF_CORE",
    note: "User account/profile data. Not official source truth.",
  },
  {
    collection: "reviews",
    classification: "app_data",
    recommended_action: "MOVE_OUT_OF_CORE",
    note: "User-generated reviews. Explicitly non-official.",
  },
  {
    collection: "reporter_reputation",
    classification: "app_data",
    recommended_action: "MOVE_OUT_OF_CORE",
    note: "App trust/reputation table. Non-official.",
  },
  {
    collection: "colleges",
    classification: "legacy_or_mixed",
    recommended_action: "AUDIT_HARD",
    note: "Large legacy CEI layer with zero official provenance fields.",
  },
  {
    collection: "colleges_v3",
    classification: "legacy_or_mixed",
    recommended_action: "AUDIT_HARD",
    note: "Large legacy CEI layer with zero official provenance fields.",
  },
  {
    collection: "exams",
    classification: "legacy_or_mixed",
    recommended_action: "AUDIT_HARD",
    note: "Exam content/editorial layer, not source-truth collection.",
  },
  {
    collection: "medical_counselling",
    classification: "empty_collection",
    recommended_action: "DELETE_OR_ARCHIVE",
    note: "Empty placeholder collection until MCC import exists.",
  },
];

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function sanitizeSample(value, depth = 0) {
  if (value == null) return value;
  if (depth >= 2) {
    if (Array.isArray(value)) return `[array:${value.length}]`;
    if (typeof value === "object") return "[object]";
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 5).map((v) => sanitizeSample(v, depth + 1));
  }

  if (typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).slice(0, 20)) {
      out[key] = sanitizeSample(value[key], depth + 1);
    }
    return out;
  }

  if (typeof value === "string") {
    return value.length > 180 ? `${value.slice(0, 180)}...` : value;
  }

  return value;
}

function serializeDoc(doc) {
  try {
    return EJSON.stringify(doc, { relaxed: true });
  } catch {
    return JSON.stringify(doc);
  }
}

async function collectionExists(db, name) {
  const row = await db.listCollections({ name }, { nameOnly: true }).next();
  return !!row;
}

async function countOfficialFields(collection) {
  const [
    totalDocs,
    withSource,
    withAuthority,
    withDataset,
    withStableImportKey,
    withFullOfficialProvenance,
  ] = await Promise.all([
    collection.countDocuments({}),
    collection.countDocuments({ source: { $exists: true, $nin: ["", null] } }),
    collection.countDocuments({ source_authority: { $exists: true, $nin: ["", null] } }),
    collection.countDocuments({ source_dataset: { $exists: true, $nin: ["", null] } }),
    collection.countDocuments({ stable_import_key: { $exists: true, $nin: ["", null] } }),
    collection.countDocuments({
      source: { $exists: true, $nin: ["", null] },
      source_authority: { $exists: true, $nin: ["", null] },
      source_dataset: { $exists: true, $nin: ["", null] },
    }),
  ]);

  return {
    total_docs: totalDocs,
    with_source: withSource,
    with_source_authority: withAuthority,
    with_source_dataset: withDataset,
    with_stable_import_key: withStableImportKey,
    with_full_official_provenance: withFullOfficialProvenance,
  };
}

async function getSamples(collection, limit) {
  const docs = await collection.find({}).limit(limit).toArray();
  return docs.map((d) => sanitizeSample(d));
}

async function exportCollectionToNdjson(collection, outPath) {
  const cursor = collection.find({}).batchSize(CURSOR_BATCH_SIZE);
  let exported = 0;

  const stream = fs.createWriteStream(outPath, { encoding: "utf8" });

  try {
    for await (const doc of cursor) {
      stream.write(serializeDoc(doc));
      stream.write("\n");
      exported += 1;
    }
  } finally {
    await new Promise((resolve) => stream.end(resolve));
  }

  return exported;
}

function shouldDropTarget(target, totalDocs) {
  if (!DROP_COLLECTIONS) return false;
  if (CONFIRM_CLEANUP !== REQUIRED_CONFIRM_TEXT) return false;

  if (target.classification === "app_data") {
    return DROP_APP_AFTER_EXPORT;
  }

  if (target.classification === "legacy_or_mixed") {
    return DROP_LEGACY_AFTER_EXPORT;
  }

  if (target.classification === "empty_collection") {
    return DROP_EMPTY_AFTER_EXPORT && totalDocs === 0;
  }

  return false;
}

function buildTextReport(report) {
  const lines = [];

  lines.push("CEI DB Cleanup Report");
  lines.push(`Generated at: ${report.generated_at}`);
  lines.push(`Mongo URI: ${report.db.uri}`);
  lines.push(`Database: ${report.db.name}`);
  lines.push(`Backup dir: ${report.backup_dir}`);
  lines.push("");
  lines.push("Execution flags:");
  lines.push(`- WRITE_EXPORTS=${report.flags.WRITE_EXPORTS}`);
  lines.push(`- DROP_COLLECTIONS=${report.flags.DROP_COLLECTIONS}`);
  lines.push(`- DROP_APP_AFTER_EXPORT=${report.flags.DROP_APP_AFTER_EXPORT}`);
  lines.push(`- DROP_EMPTY_AFTER_EXPORT=${report.flags.DROP_EMPTY_AFTER_EXPORT}`);
  lines.push(`- DROP_LEGACY_AFTER_EXPORT=${report.flags.DROP_LEGACY_AFTER_EXPORT}`);
  lines.push(`- CONFIRM_CLEANUP_MATCHED=${report.flags.CONFIRM_CLEANUP_MATCHED}`);
  lines.push("");

  lines.push("Collection actions:");
  for (const row of report.collections) {
    lines.push("");
    lines.push(`[${row.collection}]`);
    lines.push(
      `classification=${row.classification} | recommended_action=${row.recommended_action}`
    );
    lines.push(`exists=${row.exists} | total_docs=${row.total_docs}`);
    lines.push(
      `official_provenance=${row.with_full_official_provenance} | source=${row.with_source} | stable_import_key=${row.with_stable_import_key}`
    );
    lines.push(`export_written=${row.export_written} | dropped=${row.dropped}`);
    lines.push(`note=${row.note}`);
    if (row.export_path) lines.push(`export_path=${row.export_path}`);
    if (row.samples?.length) {
      lines.push("samples:");
      for (const sample of row.samples) {
        lines.push(`  ${JSON.stringify(sample)}`);
      }
    }
    if (row.error) {
      lines.push(`error=${row.error}`);
    }
  }

  return lines.join("\n");
}

async function main() {
  console.log("Mongo URI              :", MONGO_URI);
  console.log("CEI DB                 :", CEI_DB_NAME);
  console.log("WRITE_EXPORTS          :", WRITE_EXPORTS);
  console.log("DROP_COLLECTIONS       :", DROP_COLLECTIONS);
  console.log("DROP_APP_AFTER_EXPORT  :", DROP_APP_AFTER_EXPORT);
  console.log("DROP_EMPTY_AFTER_EXPORT:", DROP_EMPTY_AFTER_EXPORT);
  console.log("DROP_LEGACY_AFTER_EXPORT:", DROP_LEGACY_AFTER_EXPORT);
  console.log("CONFIRM_CLEANUP        :", CONFIRM_CLEANUP ? "(provided)" : "(missing)");

  ensureDir(PARSED_DIR);

  const backupDir = path.join(PARSED_DIR, `cei_db_cleanup_backup_${nowStamp()}`);
  if (WRITE_EXPORTS) ensureDir(backupDir);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(CEI_DB_NAME);

    const collectionReports = [];

    for (const target of TARGET_PLAN) {
      console.log("Processing collection  :", target.collection);

      const row = {
        collection: target.collection,
        classification: target.classification,
        recommended_action: target.recommended_action,
        note: target.note,
        exists: false,
        total_docs: 0,
        with_source: 0,
        with_source_authority: 0,
        with_source_dataset: 0,
        with_stable_import_key: 0,
        with_full_official_provenance: 0,
        export_written: 0,
        export_path: "",
        dropped: false,
        samples: [],
        error: "",
      };

      try {
        const exists = await collectionExists(db, target.collection);
        row.exists = exists;

        if (!exists) {
          collectionReports.push(row);
          continue;
        }

        const collection = db.collection(target.collection);

        const counts = await countOfficialFields(collection);
        Object.assign(row, counts);

        row.samples = await getSamples(collection, SAMPLE_LIMIT);

        if (WRITE_EXPORTS) {
          const exportPath = path.join(backupDir, `${target.collection}.ndjson`);
          const metaPath = path.join(backupDir, `${target.collection}.meta.json`);

          const exported = await exportCollectionToNdjson(collection, exportPath);
          row.export_written = exported;
          row.export_path = exportPath;

          writeJson(metaPath, {
            collection: target.collection,
            classification: target.classification,
            recommended_action: target.recommended_action,
            note: target.note,
            counts,
            samples: row.samples,
            exported_at: new Date().toISOString(),
            export_path: exportPath,
          });
        }

        const shouldDrop = shouldDropTarget(target, row.total_docs);
        if (shouldDrop) {
          await collection.drop();
          row.dropped = true;
        }
      } catch (err) {
        row.error = String(err);
      }

      collectionReports.push(row);
    }

    const report = {
      generated_at: new Date().toISOString(),
      db: {
        uri: MONGO_URI,
        name: CEI_DB_NAME,
      },
      backup_dir: WRITE_EXPORTS ? backupDir : "",
      flags: {
        WRITE_EXPORTS,
        DROP_COLLECTIONS,
        DROP_APP_AFTER_EXPORT,
        DROP_EMPTY_AFTER_EXPORT,
        DROP_LEGACY_AFTER_EXPORT,
        CONFIRM_CLEANUP_MATCHED: CONFIRM_CLEANUP === REQUIRED_CONFIRM_TEXT,
      },
      collections: collectionReports,
    };

    const stamp = nowStamp();
    const jsonPath = path.join(PARSED_DIR, `cei_db_cleanup_report_${stamp}.json`);
    const txtPath = path.join(PARSED_DIR, `cei_db_cleanup_report_${stamp}.txt`);

    writeJson(jsonPath, report);
    writeText(txtPath, buildTextReport(report));

    console.log("\nCEI DB CLEANUP SCRIPT COMPLETE");
    console.log("Backup dir            :", WRITE_EXPORTS ? backupDir : "(exports disabled)");
    console.log("JSON report           :", jsonPath);
    console.log("TXT report            :", txtPath);
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("CEI DB CLEANUP SCRIPT FAILED");
  console.error(err);
  process.exit(1);
});