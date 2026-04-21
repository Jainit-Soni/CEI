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

const SOURCE_DB_NAME = process.env.SOURCE_DB_NAME || "cei_v2";
const TARGET_OPS_DB_NAME = process.env.TARGET_OPS_DB_NAME || "cei_ops";
const TARGET_LEGACY_DB_NAME = process.env.TARGET_LEGACY_DB_NAME || "cei_legacy";

const CURSOR_BATCH_SIZE = Number(process.env.CURSOR_BATCH_SIZE || 1000);

const WRITE_EXPORTS = String(process.env.WRITE_EXPORTS || "true").toLowerCase() !== "false";
const MOVE_COLLECTIONS = String(process.env.MOVE_COLLECTIONS || "true").toLowerCase() !== "false";
const DROP_SOURCE_AFTER_MOVE =
  String(process.env.DROP_SOURCE_AFTER_MOVE || "false").toLowerCase() === "true";
const CONFIRM_MOVE = String(process.env.CONFIRM_MOVE || "");
const REQUIRED_CONFIRM_TEXT = "YES_MOVE_NON_CORE";

const MOVE_PLAN = [
  {
    collection: "source_registry",
    classification: "system_meta",
    target_db: "ops",
    note: "Import/source registry metadata.",
  },
  {
    collection: "data_packages",
    classification: "system_meta",
    target_db: "ops",
    note: "Package manifest registry.",
  },
  {
    collection: "coverage_reports",
    classification: "system_meta",
    target_db: "ops",
    note: "Coverage summaries and QA metadata.",
  },
  {
    collection: "trust_reports",
    classification: "system_meta",
    target_db: "ops",
    note: "Trust workflow/report queue metadata.",
  },
  {
    collection: "verified_fields",
    classification: "system_meta",
    target_db: "ops",
    note: "Verification workflow state.",
  },
  {
    collection: "colleges",
    classification: "legacy_or_mixed",
    target_db: "legacy",
    note: "Legacy CEI composite layer without official provenance.",
  },
  {
    collection: "colleges_v3",
    classification: "legacy_or_mixed",
    target_db: "legacy",
    note: "Legacy CEI v3 composite layer without official provenance.",
  },
  {
    collection: "exams",
    classification: "legacy_or_mixed",
    target_db: "legacy",
    note: "Editorial/product exam layer, not raw official-source truth.",
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

function short(v, max = 180) {
  const s = clean(v);
  return s.length > max ? `${s.slice(0, max)}...` : s;
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
    return short(value, 200);
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

function targetDbNameFromCode(code) {
  if (code === "ops") return TARGET_OPS_DB_NAME;
  if (code === "legacy") return TARGET_LEGACY_DB_NAME;
  throw new Error(`Unknown target_db code: ${code}`);
}

async function collectionExists(db, name) {
  const row = await db.listCollections({ name }, { nameOnly: true }).next();
  return !!row;
}

async function getSamples(collection, limit = 3) {
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

async function moveCollectionById({
  sourceCollection,
  targetCollection,
}) {
  const cursor = sourceCollection.find({}).batchSize(CURSOR_BATCH_SIZE);

  let moved = 0;
  let batches = 0;

  let ops = [];

  async function flush() {
    if (!ops.length) return;
    batches += 1;
    await targetCollection.bulkWrite(ops, { ordered: false });
    moved += ops.length;
    ops = [];
  }

  for await (const doc of cursor) {
    ops.push({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    });

    if (ops.length >= CURSOR_BATCH_SIZE) {
      await flush();
    }
  }

  await flush();

  return { moved, batches };
}

async function copyIndexes(sourceCollection, targetCollection) {
  const indexes = await sourceCollection.indexes();
  const copied = [];
  const skipped = [];

  for (const idx of indexes) {
    if (idx.name === "_id_") continue;

    try {
      const options = { ...idx };
      delete options.v;
      delete options.ns;
      delete options.key;
      delete options.name;

      await targetCollection.createIndex(idx.key, {
        name: idx.name,
        ...options,
      });

      copied.push(idx.name);
    } catch (err) {
      skipped.push({
        name: idx.name,
        error: String(err),
      });
    }
  }

  return { copied, skipped };
}

function shouldDropSource() {
  return DROP_SOURCE_AFTER_MOVE && CONFIRM_MOVE === REQUIRED_CONFIRM_TEXT;
}

function buildTextReport(report) {
  const lines = [];

  lines.push("CEI DB Move Non-Core Report");
  lines.push(`Generated at: ${report.generated_at}`);
  lines.push(`Mongo URI: ${report.mongo_uri}`);
  lines.push(`Source DB: ${report.source_db}`);
  lines.push(`Target Ops DB: ${report.target_ops_db}`);
  lines.push(`Target Legacy DB: ${report.target_legacy_db}`);
  lines.push(`Backup dir: ${report.backup_dir}`);
  lines.push("");

  lines.push("Flags:");
  lines.push(`- WRITE_EXPORTS=${report.flags.WRITE_EXPORTS}`);
  lines.push(`- MOVE_COLLECTIONS=${report.flags.MOVE_COLLECTIONS}`);
  lines.push(`- DROP_SOURCE_AFTER_MOVE=${report.flags.DROP_SOURCE_AFTER_MOVE}`);
  lines.push(`- CONFIRM_MOVE_MATCHED=${report.flags.CONFIRM_MOVE_MATCHED}`);
  lines.push("");

  lines.push("Collection results:");
  for (const row of report.collections) {
    lines.push("");
    lines.push(`[${row.collection}]`);
    lines.push(
      `classification=${row.classification} | target_db=${row.target_db_name}`
    );
    lines.push(`source_exists=${row.source_exists} | source_count=${row.source_count}`);
    lines.push(
      `target_before=${row.target_count_before} | target_after=${row.target_count_after}`
    );
    lines.push(
      `export_written=${row.export_written} | moved_ops=${row.moved_ops} | dropped_source=${row.dropped_source}`
    );
    lines.push(`note=${row.note}`);
    if (row.export_path) lines.push(`export_path=${row.export_path}`);
    if (row.index_copy) {
      lines.push(
        `indexes_copied=${row.index_copy.copied.length} | indexes_skipped=${row.index_copy.skipped.length}`
      );
    }
    if (row.samples?.length) {
      lines.push("samples:");
      for (const sample of row.samples) {
        lines.push(`  ${JSON.stringify(sample)}`);
      }
    }
    if (row.error) lines.push(`error=${row.error}`);
  }

  return lines.join("\n");
}

async function main() {
  console.log("Mongo URI             :", MONGO_URI);
  console.log("Source DB             :", SOURCE_DB_NAME);
  console.log("Target Ops DB         :", TARGET_OPS_DB_NAME);
  console.log("Target Legacy DB      :", TARGET_LEGACY_DB_NAME);
  console.log("WRITE_EXPORTS         :", WRITE_EXPORTS);
  console.log("MOVE_COLLECTIONS      :", MOVE_COLLECTIONS);
  console.log("DROP_SOURCE_AFTER_MOVE:", DROP_SOURCE_AFTER_MOVE);
  console.log("CONFIRM_MOVE          :", CONFIRM_MOVE ? "(provided)" : "(missing)");

  ensureDir(PARSED_DIR);

  const backupDir = path.join(PARSED_DIR, `cei_db_move_noncore_backup_${nowStamp()}`);
  if (WRITE_EXPORTS) ensureDir(backupDir);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();

    const sourceDb = client.db(SOURCE_DB_NAME);
    const opsDb = client.db(TARGET_OPS_DB_NAME);
    const legacyDb = client.db(TARGET_LEGACY_DB_NAME);

    const collectionReports = [];

    for (const target of MOVE_PLAN) {
      console.log("Processing collection :", target.collection);

      const targetDbName = targetDbNameFromCode(target.target_db);
      const targetDb = target.target_db === "ops" ? opsDb : legacyDb;

      const row = {
        collection: target.collection,
        classification: target.classification,
        target_db_code: target.target_db,
        target_db_name: targetDbName,
        note: target.note,
        source_exists: false,
        source_count: 0,
        target_count_before: 0,
        target_count_after: 0,
        export_written: 0,
        export_path: "",
        moved_ops: 0,
        move_batches: 0,
        dropped_source: false,
        samples: [],
        index_copy: null,
        error: "",
      };

      try {
        const exists = await collectionExists(sourceDb, target.collection);
        row.source_exists = exists;

        if (!exists) {
          collectionReports.push(row);
          continue;
        }

        const sourceCollection = sourceDb.collection(target.collection);
        const targetCollection = targetDb.collection(target.collection);

        row.source_count = await sourceCollection.countDocuments({});
        row.target_count_before = await targetCollection.countDocuments({});
        row.samples = await getSamples(sourceCollection, 3);

        if (WRITE_EXPORTS) {
          const exportPath = path.join(backupDir, `${target.collection}.ndjson`);
          const metaPath = path.join(backupDir, `${target.collection}.meta.json`);

          row.export_written = await exportCollectionToNdjson(sourceCollection, exportPath);
          row.export_path = exportPath;

          writeJson(metaPath, {
            collection: target.collection,
            classification: target.classification,
            target_db_name: targetDbName,
            note: target.note,
            source_count: row.source_count,
            target_count_before: row.target_count_before,
            samples: row.samples,
            exported_at: new Date().toISOString(),
            export_path: exportPath,
          });
        }

        if (MOVE_COLLECTIONS) {
          row.index_copy = await copyIndexes(sourceCollection, targetCollection);

          const moveRes = await moveCollectionById({
            sourceCollection,
            targetCollection,
          });

          row.moved_ops = moveRes.moved;
          row.move_batches = moveRes.batches;
        }

        row.target_count_after = await targetCollection.countDocuments({});

        const safeToDrop =
          shouldDropSource() &&
          row.source_count > 0 &&
          row.target_count_after >= row.source_count;

        if (safeToDrop) {
          await sourceCollection.drop();
          row.dropped_source = true;
        }
      } catch (err) {
        row.error = String(err);
      }

      collectionReports.push(row);
    }

    const report = {
      generated_at: new Date().toISOString(),
      mongo_uri: MONGO_URI,
      source_db: SOURCE_DB_NAME,
      target_ops_db: TARGET_OPS_DB_NAME,
      target_legacy_db: TARGET_LEGACY_DB_NAME,
      backup_dir: WRITE_EXPORTS ? backupDir : "",
      flags: {
        WRITE_EXPORTS,
        MOVE_COLLECTIONS,
        DROP_SOURCE_AFTER_MOVE,
        CONFIRM_MOVE_MATCHED: CONFIRM_MOVE === REQUIRED_CONFIRM_TEXT,
      },
      collections: collectionReports,
    };

    const stamp = nowStamp();
    const jsonPath = path.join(PARSED_DIR, `cei_db_move_noncore_report_${stamp}.json`);
    const txtPath = path.join(PARSED_DIR, `cei_db_move_noncore_report_${stamp}.txt`);

    writeJson(jsonPath, report);
    writeText(txtPath, buildTextReport(report));

    console.log("\nCEI DB MOVE NON-CORE SCRIPT COMPLETE");
    console.log("Backup dir            :", WRITE_EXPORTS ? backupDir : "(exports disabled)");
    console.log("JSON report           :", jsonPath);
    console.log("TXT report            :", txtPath);
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("CEI DB MOVE NON-CORE SCRIPT FAILED");
  console.error(err);
  process.exit(1);
});