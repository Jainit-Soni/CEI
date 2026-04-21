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
const SAMPLE_LIMIT = Number(process.env.SAMPLE_LIMIT || 3);

const OFFICIAL_COLLECTION_HINTS = new Set([
  "institutions",
  "course_offerings",
  "engineering_cutoffs",
  "rankings",
  "medical_counselling",
]);

const SYSTEM_COLLECTION_HINTS = new Set([
  "source_registry",
  "data_packages",
  "coverage_reports",
  "trust_reports",
  "verified_fields",
]);

const APP_COLLECTION_HINTS = new Set([
  "users",
  "activitylogs",
  "reviews",
  "reporter_reputation",
]);

const LEGACY_MIXED_COLLECTION_HINTS = new Set([
  "colleges",
  "colleges_v3",
  "exams",
]);

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function norm(text) {
  return clean(text).toLowerCase();
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

function short(v, max = 140) {
  const s = clean(v);
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

function topNMapEntries(obj, n = 10) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

function sanitizeForSample(value, depth = 0) {
  if (value == null) return value;
  if (depth >= 2) {
    if (Array.isArray(value)) return `[array:${value.length}]`;
    if (typeof value === "object") return "[object]";
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 5).map((v) => sanitizeForSample(v, depth + 1));
  }

  if (typeof value === "object") {
    const out = {};
    const keys = Object.keys(value).slice(0, 20);
    for (const key of keys) {
      out[key] = sanitizeForSample(value[key], depth + 1);
    }
    return out;
  }

  if (typeof value === "string") {
    return short(value, 200);
  }

  return value;
}

function classifyCollectionName(name) {
  const n = norm(name);

  if (OFFICIAL_COLLECTION_HINTS.has(n)) return "official_hint";
  if (SYSTEM_COLLECTION_HINTS.has(n)) return "system_hint";
  if (APP_COLLECTION_HINTS.has(n)) return "app_hint";
  if (LEGACY_MIXED_COLLECTION_HINTS.has(n)) return "legacy_hint";

  return "unknown_hint";
}

function computeRecommendation(classification, totalDocs) {
  if (classification === "official_data") return "KEEP_OFFICIAL";
  if (classification === "system_meta") return "KEEP_SYSTEM";
  if (classification === "app_data") return "MOVE_OUT_OF_CORE";
  if (classification === "legacy_or_mixed") return "AUDIT_HARD";
  if (classification === "empty_collection") {
    return totalDocs === 0 ? "DELETE_OR_ARCHIVE" : "AUDIT_HARD";
  }
  return "INVESTIGATE";
}

function computeClassification({
  collectionName,
  totalDocs,
  withFullOfficialProvenance,
  withSourceOnly,
  sourceBreakdown,
}) {
  const hint = classifyCollectionName(collectionName);
  const officialRatio =
    totalDocs > 0 ? withFullOfficialProvenance / totalDocs : 0;
  const sourceRatio =
    totalDocs > 0 ? (withSourceOnly + withFullOfficialProvenance) / totalDocs : 0;

  if (totalDocs === 0) return "empty_collection";

  if (hint === "system_hint") return "system_meta";
  if (hint === "app_hint") return "app_data";

  if (hint === "official_hint" && officialRatio >= 0.5) return "official_data";
  if (hint === "legacy_hint" && sourceRatio > 0 && officialRatio < 0.95) return "legacy_or_mixed";

  if (officialRatio >= 0.95) return "official_data";
  if (officialRatio > 0 && officialRatio < 0.95) return "legacy_or_mixed";
  if (sourceRatio > 0 && officialRatio === 0) return "legacy_or_mixed";

  const sourceKeys = new Set(sourceBreakdown.map((x) => norm(x.key)));
  if (sourceKeys.has("aicte") || sourceKeys.has("josaa") || sourceKeys.has("nirf")) {
    return "legacy_or_mixed";
  }

  if (hint === "legacy_hint") return "legacy_or_mixed";
  if (hint === "official_hint") return "legacy_or_mixed";

  return "unknown";
}

async function getSourceBreakdown(collection) {
  const rows = await collection
    .aggregate([
      {
        $match: {
          source: { $exists: true, $nin: ["", null] },
        },
      },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 15 },
    ])
    .toArray();

  return rows.map((r) => ({
    key: clean(r._id),
    count: r.count,
  }));
}

async function getAuthorityBreakdown(collection) {
  const rows = await collection
    .aggregate([
      {
        $match: {
          source_authority: { $exists: true, $nin: ["", null] },
        },
      },
      {
        $group: {
          _id: "$source_authority",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 15 },
    ])
    .toArray();

  return rows.map((r) => ({
    key: clean(r._id),
    count: r.count,
  }));
}

async function getDatasetBreakdown(collection) {
  const rows = await collection
    .aggregate([
      {
        $match: {
          source_dataset: { $exists: true, $nin: ["", null] },
        },
      },
      {
        $group: {
          _id: "$source_dataset",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 15 },
    ])
    .toArray();

  return rows.map((r) => ({
    key: clean(r._id),
    count: r.count,
  }));
}

async function getLightSamples(collection, limit) {
  const docs = await collection.find({}).limit(limit).toArray();
  return docs.map((doc) => sanitizeForSample(doc));
}

async function getCollectionAudit(db, name) {
  const collection = db.collection(name);

  const totalDocs = await collection.countDocuments({});

  const withSourceOnly = await collection.countDocuments({
    source: { $exists: true, $nin: ["", null] },
  });

  const withAuthority = await collection.countDocuments({
    source_authority: { $exists: true, $nin: ["", null] },
  });

  const withDataset = await collection.countDocuments({
    source_dataset: { $exists: true, $nin: ["", null] },
  });

  const withFullOfficialProvenance = await collection.countDocuments({
    source: { $exists: true, $nin: ["", null] },
    source_authority: { $exists: true, $nin: ["", null] },
    source_dataset: { $exists: true, $nin: ["", null] },
  });

  const withStableImportKey = await collection.countDocuments({
    stable_import_key: { $exists: true, $nin: ["", null] },
  });

  const sourceBreakdown = await getSourceBreakdown(collection);
  const authorityBreakdown = await getAuthorityBreakdown(collection);
  const datasetBreakdown = await getDatasetBreakdown(collection);
  const samples = await getLightSamples(collection, SAMPLE_LIMIT);

  const classification = computeClassification({
    collectionName: name,
    totalDocs,
    withFullOfficialProvenance,
    withSourceOnly,
    sourceBreakdown,
  });

  const recommendation = computeRecommendation(classification, totalDocs);

  return {
    collection_name: name,
    collection_name_hint: classifyCollectionName(name),
    total_docs: totalDocs,
    with_source: withSourceOnly,
    with_source_authority: withAuthority,
    with_source_dataset: withDataset,
    with_full_official_provenance: withFullOfficialProvenance,
    with_stable_import_key: withStableImportKey,
    official_provenance_ratio:
      totalDocs > 0
        ? Number((withFullOfficialProvenance / totalDocs).toFixed(4))
        : 0,
    source_ratio:
      totalDocs > 0 ? Number((withSourceOnly / totalDocs).toFixed(4)) : 0,
    classification,
    recommendation,
    source_breakdown: sourceBreakdown,
    authority_breakdown: authorityBreakdown,
    dataset_breakdown: datasetBreakdown,
    samples,
  };
}

function buildSummary(audits) {
  const byClass = {};
  const byRecommendation = {};

  for (const row of audits) {
    byClass[row.classification] = (byClass[row.classification] || 0) + 1;
    byRecommendation[row.recommendation] =
      (byRecommendation[row.recommendation] || 0) + 1;
  }

  return {
    total_collections: audits.length,
    classification_counts: topNMapEntries(byClass, 20),
    recommendation_counts: topNMapEntries(byRecommendation, 20),
  };
}

function buildTextReport({
  dbName,
  mongoUri,
  audits,
  summary,
}) {
  const lines = [];

  lines.push("CEI DB Officiality Audit");
  lines.push(`Database: ${dbName}`);
  lines.push(`Mongo URI: ${mongoUri}`);
  lines.push("");

  lines.push("Summary:");
  lines.push(`- Collections scanned: ${summary.total_collections}`);
  for (const row of summary.classification_counts) {
    lines.push(`- Classification ${row.key}: ${row.count}`);
  }
  for (const row of summary.recommendation_counts) {
    lines.push(`- Recommendation ${row.key}: ${row.count}`);
  }

  lines.push("");
  lines.push("Collection details:");

  for (const row of audits) {
    lines.push("");
    lines.push(`[${row.collection_name}]`);
    lines.push(
      `classification=${row.classification} | recommendation=${row.recommendation} | hint=${row.collection_name_hint}`
    );
    lines.push(
      `total_docs=${row.total_docs} | full_provenance=${row.with_full_official_provenance} | source_only=${row.with_source} | stable_import_key=${row.with_stable_import_key}`
    );
    lines.push(
      `official_provenance_ratio=${row.official_provenance_ratio} | source_ratio=${row.source_ratio}`
    );

    if (row.source_breakdown.length) {
      lines.push(
        `source_breakdown=${row.source_breakdown
          .map((x) => `${x.key}:${x.count}`)
          .join(", ")}`
      );
    }

    if (row.authority_breakdown.length) {
      lines.push(
        `authority_breakdown=${row.authority_breakdown
          .map((x) => `${x.key}:${x.count}`)
          .join(", ")}`
      );
    }

    if (row.dataset_breakdown.length) {
      lines.push(
        `dataset_breakdown=${row.dataset_breakdown
          .map((x) => `${x.key}:${x.count}`)
          .join(", ")}`
      );
    }

    if (row.samples.length) {
      lines.push("sample_docs:");
      for (const sample of row.samples) {
        lines.push(`  ${JSON.stringify(sample)}`);
      }
    }
  }

  return lines.join("\n");
}

async function main() {
  console.log("Mongo URI       :", MONGO_URI);
  console.log("CEI DB          :", CEI_DB_NAME);
  console.log("Sample limit    :", SAMPLE_LIMIT);

  ensureDir(PARSED_DIR);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(CEI_DB_NAME);

    const collectionsMeta = await db.listCollections({}, { nameOnly: true }).toArray();
    const collectionNames = collectionsMeta.map((c) => c.name).sort();

    console.log("Collections found:", collectionNames.length);

    const audits = [];
    for (const name of collectionNames) {
      console.log("Auditing collection:", name);
      const row = await getCollectionAudit(db, name);
      audits.push(row);
    }

    const summary = buildSummary(audits);

    const report = {
      generated_at: new Date().toISOString(),
      db: {
        uri: MONGO_URI,
        name: CEI_DB_NAME,
      },
      summary,
      collections: audits,
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonPath = path.join(PARSED_DIR, `cei_db_officiality_audit_${stamp}.json`);
    const txtPath = path.join(PARSED_DIR, `cei_db_officiality_audit_${stamp}.txt`);

    writeJson(jsonPath, report);
    writeText(
      txtPath,
      buildTextReport({
        dbName: CEI_DB_NAME,
        mongoUri: MONGO_URI,
        audits,
        summary,
      })
    );

    console.log("\nCEI DB OFFICIALITY AUDIT COMPLETE");
    console.log("JSON report      :", jsonPath);
    console.log("TXT report       :", txtPath);
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("CEI DB OFFICIALITY AUDIT FAILED");
  console.error(err);
  process.exit(1);
});