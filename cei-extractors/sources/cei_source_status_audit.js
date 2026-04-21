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

const SOURCE_DEFS = [
  {
    key: "aicte",
    label: "AICTE",
    aliases: ["aicte", "approved_institutes", "approved_courses"],
    extraQueries: [
      { aicte_id: { $exists: true, $nin: ["", null] } },
      { institution_id: { $regex: /^aicte:/i } },
    ],
  },
  {
    key: "nirf",
    label: "NIRF",
    aliases: ["nirf", "rankings"],
    extraQueries: [],
  },
  {
    key: "josaa",
    label: "JoSAA",
    aliases: ["josaa", "joSAA", "orcr", "seat_matrix"],
    extraQueries: [],
  },
  {
    key: "csab",
    label: "CSAB",
    aliases: ["csab"],
    extraQueries: [],
  },
  {
    key: "mcc",
    label: "MCC",
    aliases: ["mcc", "medical counselling committee", "medical_counselling"],
    extraQueries: [],
  },
  {
    key: "aishe",
    label: "AISHE",
    aliases: ["aishe"],
    extraQueries: [],
  },
];

const REGISTRY_COLLECTION_NAMES = new Set([
  "source_registry",
  "data_packages",
  "coverage_reports",
]);

const SEARCH_FIELDS = [
  "source",
  "source_id",
  "source_dataset",
  "source_authority",
  "authority",
  "provider",
  "dataset",
  "extractor_scope",
  "package_id",
  "source_package_id",
  "manifest_path",
  "semantic_clean_manifest_path",
  "source_package_manifest_path",
  "source_record_type",
  "notes",
];

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function safeRegexFromAliases(aliases) {
  const escaped = aliases
    .map((a) => String(a).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter(Boolean);

  return new RegExp(escaped.join("|"), "i");
}

function collectionIsRegistryLike(name) {
  return REGISTRY_COLLECTION_NAMES.has(name);
}

function buildSourceQuery(def) {
  const regex = safeRegexFromAliases(def.aliases);
  const or = [];

  for (const field of SEARCH_FIELDS) {
    or.push({ [field]: { $regex: regex } });
  }

  for (const extra of def.extraQueries || []) {
    or.push(extra);
  }

  return { $or: or };
}

function projectionForSample() {
  return {
    _id: 0,
    source: 1,
    source_id: 1,
    source_dataset: 1,
    source_authority: 1,
    source_record_type: 1,
    institution_id: 1,
    aicte_id: 1,
    institution_name: 1,
    course_name: 1,
    state_name: 1,
    stable_import_key: 1,
    package_id: 1,
    manifest_path: 1,
  };
}

async function estimateCollectionCount(collection) {
  try {
    return await collection.estimatedDocumentCount();
  } catch {
    try {
      return await collection.countDocuments({});
    } catch {
      return null;
    }
  }
}

async function sampleDocs(collection, query, limit) {
  try {
    return await collection
      .find(query, { projection: projectionForSample() })
      .limit(limit)
      .toArray();
  } catch {
    return [];
  }
}

function inferStatus({
  mainMatchedDocs,
  hintedCollectionTotalDocs,
  registryMatchedDocs,
}) {
  if (mainMatchedDocs > 0) {
    return {
      status: "data_present",
      confidence:
        registryMatchedDocs > 0 || hintedCollectionTotalDocs > 0 ? "high" : "medium",
    };
  }

  if (hintedCollectionTotalDocs > 0) {
    return {
      status: "collection_name_hint_present",
      confidence: "medium",
    };
  }

  if (registryMatchedDocs > 0) {
    return {
      status: "registry_only",
      confidence: "low",
    };
  }

  return {
    status: "not_found",
    confidence: "none",
  };
}

function topCollections(rows, limit = 20) {
  return rows
    .slice()
    .sort((a, b) => {
      const aScore = (a.matched_docs || 0) + (a.collection_name_hint_total || 0);
      const bScore = (b.matched_docs || 0) + (b.collection_name_hint_total || 0);
      return bScore - aScore || a.collection.localeCompare(b.collection);
    })
    .slice(0, limit);
}

async function auditSource(db, def, allCollectionNames) {
  const regex = safeRegexFromAliases(def.aliases);
  const query = buildSourceQuery(def);

  const collectionRows = [];

  for (const name of allCollectionNames) {
    const collection = db.collection(name);
    const totalDocs = await estimateCollectionCount(collection);
    const nameHint = regex.test(name);

    let matchedDocs = 0;
    try {
      matchedDocs = await collection.countDocuments(query);
    } catch {
      matchedDocs = 0;
    }

    const shouldSample = matchedDocs > 0 || nameHint;
    const sample = shouldSample
      ? await sampleDocs(collection, matchedDocs > 0 ? query : {}, SAMPLE_LIMIT)
      : [];

    collectionRows.push({
      collection: name,
      registry_like: collectionIsRegistryLike(name),
      total_docs: totalDocs,
      matched_docs: matchedDocs,
      collection_name_hint: nameHint,
      collection_name_hint_total: nameHint ? totalDocs : 0,
      sample_docs: sample,
    });
  }

  const mainRows = collectionRows.filter((r) => !r.registry_like);
  const registryRows = collectionRows.filter((r) => r.registry_like);

  const mainMatchedDocs = mainRows.reduce((sum, r) => sum + (r.matched_docs || 0), 0);
  const registryMatchedDocs = registryRows.reduce((sum, r) => sum + (r.matched_docs || 0), 0);
  const hintedCollectionTotalDocs = mainRows.reduce(
    (sum, r) => sum + (r.collection_name_hint_total || 0),
    0
  );

  const inference = inferStatus({
    mainMatchedDocs,
    hintedCollectionTotalDocs,
    registryMatchedDocs,
  });

  return {
    source_key: def.key,
    source_label: def.label,
    aliases: def.aliases,
    summary: {
      main_matched_docs: mainMatchedDocs,
      registry_matched_docs: registryMatchedDocs,
      hinted_collection_total_docs: hintedCollectionTotalDocs,
      collections_with_matches: collectionRows.filter((r) => r.matched_docs > 0).length,
      collections_with_name_hint: collectionRows.filter((r) => r.collection_name_hint).length,
      status: inference.status,
      confidence: inference.confidence,
    },
    collections: topCollections(
      collectionRows.filter((r) => r.matched_docs > 0 || r.collection_name_hint)
    ),
  };
}

function buildHumanReport({
  dbName,
  mongoUri,
  collectionNames,
  sources,
}) {
  const lines = [];

  lines.push(`CEI Source Status Audit`);
  lines.push(`Database: ${dbName}`);
  lines.push(`Mongo URI: ${mongoUri}`);
  lines.push(`Collections scanned: ${collectionNames.length}`);
  lines.push("");

  lines.push("Source summary:");
  for (const source of sources) {
    lines.push(
      `- ${source.source_label}: status=${source.summary.status}, confidence=${source.summary.confidence}, main_docs=${source.summary.main_matched_docs}, registry_docs=${source.summary.registry_matched_docs}, hinted_docs=${source.summary.hinted_collection_total_docs}`
    );
  }

  lines.push("");
  lines.push("Details:");

  for (const source of sources) {
    lines.push(``);
    lines.push(`[${source.source_label}]`);
    lines.push(`Aliases: ${source.aliases.join(", ")}`);
    lines.push(
      `Status: ${source.summary.status} | Confidence: ${source.summary.confidence}`
    );
    lines.push(
      `Main matched docs: ${source.summary.main_matched_docs} | Registry matched docs: ${source.summary.registry_matched_docs} | Hinted collection docs: ${source.summary.hinted_collection_total_docs}`
    );

    for (const row of source.collections) {
      lines.push(
        `  - ${row.collection} | matched=${row.matched_docs} | total=${row.total_docs} | registry=${row.registry_like} | name_hint=${row.collection_name_hint}`
      );
      if (row.sample_docs && row.sample_docs.length) {
        for (const doc of row.sample_docs) {
          lines.push(`      sample=${JSON.stringify(doc)}`);
        }
      }
    }
  }

  return lines.join("\n");
}

async function main() {
  console.log("Mongo URI        :", MONGO_URI);
  console.log("CEI DB           :", CEI_DB_NAME);
  console.log("Sample limit     :", SAMPLE_LIMIT);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(CEI_DB_NAME);

    const collectionsMeta = await db.listCollections({}, { nameOnly: true }).toArray();
    const collectionNames = collectionsMeta.map((c) => c.name).sort();

    console.log("Collections found:", collectionNames.length);

    const sources = [];
    for (const def of SOURCE_DEFS) {
      console.log(`Auditing source   : ${def.label}`);
      const row = await auditSource(db, def, collectionNames);
      sources.push(row);
    }

    const report = {
      generated_at: new Date().toISOString(),
      db: {
        uri: MONGO_URI,
        name: CEI_DB_NAME,
      },
      collections_scanned: collectionNames,
      sources,
    };

    const outDir = PARSED_DIR;
    ensureDir(outDir);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonPath = path.join(outDir, `cei_source_status_audit_${stamp}.json`);
    const txtPath = path.join(outDir, `cei_source_status_audit_${stamp}.txt`);

    writeJson(jsonPath, report);
    writeText(
      txtPath,
      buildHumanReport({
        dbName: CEI_DB_NAME,
        mongoUri: MONGO_URI,
        collectionNames,
        sources,
      })
    );

    console.log("\nCEI SOURCE STATUS AUDIT COMPLETE");
    console.log("JSON report       :", jsonPath);
    console.log("TXT report        :", txtPath);
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("CEI SOURCE STATUS AUDIT FAILED");
  console.error(err);
  process.exit(1);
});