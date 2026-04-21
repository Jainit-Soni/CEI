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

const RANKINGS_COLLECTION =
  process.env.CEI_RANKINGS_COLLECTION || "rankings";
const SOURCE_REGISTRY_COLLECTION =
  process.env.CEI_SOURCE_REGISTRY_COLLECTION || "source_registry";
const PACKAGE_REGISTRY_COLLECTION =
  process.env.CEI_PACKAGE_REGISTRY_COLLECTION || "data_packages";
const COVERAGE_REPORTS_COLLECTION =
  process.env.CEI_COVERAGE_REPORTS_COLLECTION || "coverage_reports";

const DRY_RUN = String(process.env.DRY_RUN || "false").toLowerCase() === "true";
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 500);
const NIRF_INPUT = (process.env.NIRF_INPUT || "").trim();

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function norm(text) {
  return clean(text).toLowerCase();
}

function listDir(dirPath) {
  return fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : [];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function safeString(v) {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function numberOrNull(v) {
  const s = clean(v);
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function titleCase(text) {
  const s = clean(text).toLowerCase();
  if (!s) return "";
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows) {
  if (!rows.length) return "";
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

function detectYearFromPath(filePath) {
  const m = String(filePath).match(/20\d{2}/g);
  if (!m || !m.length) return null;
  return Number(m[m.length - 1]);
}

function detectYearFromRow(row, fallbackYear) {
  const candidates = [
    row.year,
    row.ranking_year,
    row.admission_year,
    row.release_year,
    row.report_year,
  ]
    .map(clean)
    .filter(Boolean);

  for (const c of candidates) {
    if (/^20\d{2}$/.test(c)) return Number(c);
  }

  return fallbackYear ?? null;
}

function normalizeCategory(raw) {
  const s = clean(raw);
  if (!s) return "";
  const map = {
    overall: "Overall",
    university: "University",
    college: "College",
    research: "Research",
    engineering: "Engineering",
    management: "Management",
    pharmacy: "Pharmacy",
    medical: "Medical",
    dental: "Dental",
    law: "Law",
    architecture: "Architecture",
    agriculture: "Agriculture",
    innovation: "Innovation",
    openuniversity: "Open University",
    skilluniversity: "Skill University",
    statepublicuniversity: "State Public University",
  };
  const key = norm(s).replace(/\s+/g, "");
  return map[key] || titleCase(s);
}

function normalizeInstitutionName(row) {
  return clean(
    row.institute_name ||
      row.institution_name ||
      row.name ||
      row.college_name ||
      row.university_name ||
      row.institute ||
      row.institution
  );
}

function normalizeStateName(row) {
  const raw = clean(
    row.state ||
      row.state_name ||
      row.location_state ||
      row.province
  );
  if (!raw) return "";

  const map = {
    "andaman and nicobar islands": "Andaman and Nicobar Islands",
    "jammu and kashmir": "Jammu and Kashmir",
    orissa: "Odisha",
  };

  return map[norm(raw)] || titleCase(raw);
}

function normalizeCity(row) {
  return clean(row.city || row.location_city || row.town);
}

function normalizeCategoryFromRow(row, filePath) {
  const direct = clean(
    row.category ||
      row.ranking_category ||
      row.stream ||
      row.domain
  );
  if (direct) return normalizeCategory(direct);

  const base = path.basename(filePath, path.extname(filePath));
  const m = base.match(
    /(overall|university|college|research|engineering|management|pharmacy|medical|dental|law|architecture|agriculture|innovation|openuniversity|skilluniversity|statepublicuniversity)/i
  );
  return m ? normalizeCategory(m[1]) : "";
}

function normalizeRank(row) {
  return (
    numberOrNull(row.rank) ??
    numberOrNull(row.nirf_rank) ??
    numberOrNull(row.ranking) ??
    numberOrNull(row.position)
  );
}

function normalizeScore(row) {
  return (
    numberOrNull(row.score) ??
    numberOrNull(row.nirf_score) ??
    numberOrNull(row.total_score)
  );
}

function buildStableImportKey(doc) {
  return [
    "nirf_ranking",
    doc.ranking_year,
    doc.category,
    doc.rank,
    doc.institution_name,
    doc.city,
    doc.state_name,
  ].join("::");
}

function normalizeNirfRow(row, sourceMeta) {
  const rankingYear = detectYearFromRow(row, sourceMeta.fallbackYear);
  const category = normalizeCategoryFromRow(row, sourceMeta.inputPath);
  const institutionName = normalizeInstitutionName(row);
  const city = normalizeCity(row);
  const stateName = normalizeStateName(row);
  const rank = normalizeRank(row);
  const score = normalizeScore(row);

  const doc = {
    source: "nirf",
    source_authority: "NIRF",
    source_dataset: "rankings",
    source_record_type: "ranking",
    source_extractor_scope: "import_existing_parsed",
    source_input_path: sourceMeta.inputPath,
    source_input_filename: path.basename(sourceMeta.inputPath),

    ranking_year: rankingYear,
    category,
    rank,
    score,

    institution_name: institutionName,
    city,
    state_name: stateName,

    nirf_id: clean(row.nirf_id || row.id || ""),
    original_row: row,
  };

  doc.stable_import_key = buildStableImportKey(doc);
  return doc;
}

function scoreCandidateRows(rows, filePath) {
  if (!Array.isArray(rows) || !rows.length) return -1e9;

  let score = rows.length;

  const sample = rows.slice(0, 20);
  let signal = 0;
  for (const row of sample) {
    const keys = Object.keys(row || {}).map(norm);
    if (
      keys.some((k) =>
        [
          "rank",
          "nirf_rank",
          "ranking",
          "position",
          "score",
          "nirf_score",
          "institute_name",
          "institution_name",
          "college_name",
          "category",
          "ranking_category",
          "stream",
        ].includes(k)
      )
    ) {
      signal += 5;
    }
  }

  score += signal;

  const base = norm(path.basename(filePath));
  if (base.includes("nirf")) score += 50;
  if (base.includes("ranking")) score += 40;
  if (base.includes("rankings")) score += 40;
  if (base.includes("summary")) score -= 200;
  if (base.includes("qa")) score -= 200;
  if (base.includes("report")) score -= 200;

  return score;
}

function discoverNirfInputPath() {
  if (NIRF_INPUT) {
    if (!fs.existsSync(NIRF_INPUT)) {
      throw new Error(`NIRF_INPUT not found: ${NIRF_INPUT}`);
    }
    return NIRF_INPUT;
  }

  const files = listDir(PARSED_DIR)
    .filter((name) => name.toLowerCase().includes("nirf") && name.endsWith(".json"))
    .map((name) => path.join(PARSED_DIR, name));

  if (!files.length) {
    throw new Error("No NIRF JSON files found in parsed output. Set NIRF_INPUT explicitly.");
  }

  let best = null;

  for (const filePath of files) {
    try {
      const parsed = readJson(filePath);
      if (!Array.isArray(parsed)) continue;

      const score = scoreCandidateRows(parsed, filePath);
      if (!best || score > best.score) {
        best = {
          filePath,
          rows: parsed,
          score,
        };
      }
    } catch {
      // ignore bad candidate
    }
  }

  if (!best) {
    throw new Error("Could not find a usable NIRF array JSON candidate. Set NIRF_INPUT explicitly.");
  }

  return best.filePath;
}

function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = clean(row.stable_import_key);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

    const keys = batch.map((doc) => clean(doc[keyField])).filter(Boolean);

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

    const ops = batch
      .filter((doc) => clean(doc[keyField]))
      .map((doc) => ({
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
      }));

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

async function upsertSmallDoc({
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
  const inputPath = discoverNirfInputPath();
  const inputRowsRaw = readJson(inputPath);

  if (!Array.isArray(inputRowsRaw) || !inputRowsRaw.length) {
    throw new Error(`NIRF input is not a non-empty array: ${inputPath}`);
  }

  const fallbackYear = detectYearFromPath(inputPath);
  const sourceMeta = {
    inputPath,
    fallbackYear,
  };

  const normalizedRows = dedupeRows(
    inputRowsRaw.map((row) => normalizeNirfRow(row, sourceMeta))
  );

  const packageId = `nirf_cei_package_${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const packageDir = path.join(PARSED_DIR, packageId);
  ensureDir(packageDir);

  const importReadyJsonPath = path.join(packageDir, "nirf_rankings_import_ready.json");
  const importReadyCsvPath = path.join(packageDir, "nirf_rankings_import_ready.csv");
  const sourceRegistryPath = path.join(packageDir, "nirf_source_registry.json");
  const coverageSummaryPath = path.join(packageDir, "nirf_coverage_summary.json");
  const packageManifestPath = path.join(packageDir, "nirf_package_manifest.json");

  const byYear = {};
  const byCategory = {};
  for (const row of normalizedRows) {
    const y = clean(row.ranking_year) || "(blank)";
    const c = clean(row.category) || "(blank)";
    byYear[y] = (byYear[y] || 0) + 1;
    byCategory[c] = (byCategory[c] || 0) + 1;
  }

  const sourceRegistry = [
    {
      source_id: "nirf_rankings",
      authority: "NIRF",
      source_type: "ranking_dataset",
      acquisition_method: "import_existing_parsed_json",
      granularity: "ranking",
      temporal_scope: Object.keys(byYear).sort(),
      row_count: normalizedRows.length,
      key_field: "stable_import_key",
      input_file: inputPath,
      package_dir: packageDir,
      notes: "NIRF rankings imported from existing parsed JSON candidate.",
    },
  ];

  const coverageSummary = {
    total_rows: normalizedRows.length,
    year_distribution: Object.entries(byYear)
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([key, count]) => ({ key, count })),
    category_distribution: Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, count })),
  };

  const packageManifest = {
    package_id: packageId,
    package_dir: packageDir,
    inputs: {
      rankings_json: inputPath,
    },
    outputs: {
      rankings_json: importReadyJsonPath,
      rankings_csv: importReadyCsvPath,
      source_registry_json: sourceRegistryPath,
      coverage_summary_json: coverageSummaryPath,
    },
    counts: {
      rankings: normalizedRows.length,
    },
  };

  writeJson(importReadyJsonPath, normalizedRows);
  fs.writeFileSync(importReadyCsvPath, rowsToCsv(normalizedRows), "utf8");
  writeJson(sourceRegistryPath, sourceRegistry);
  writeJson(coverageSummaryPath, coverageSummary);
  writeJson(packageManifestPath, packageManifest);

  console.log("Using NIRF input      :", inputPath);
  console.log("Rows parsed           :", inputRowsRaw.length);
  console.log("Rows normalized       :", normalizedRows.length);
  console.log("Mongo URI             :", MONGO_URI);
  console.log("CEI DB                :", CEI_DB_NAME);
  console.log("Dry run               :", DRY_RUN);
  console.log("Batch size            :", BATCH_SIZE);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(CEI_DB_NAME);

    await ensureIndexes(db);

    const enrichedDocs = normalizedRows.map((doc) => ({
      ...doc,
      source_package_id: packageId,
      source_package_dir: packageDir,
      source_package_manifest_path: packageManifestPath,
      imported_at: new Date().toISOString(),
    }));

    const rankingStats = await upsertDocuments({
      collection: db.collection(RANKINGS_COLLECTION),
      docs: enrichedDocs,
      keyField: "stable_import_key",
      batchSize: BATCH_SIZE,
      dryRun: DRY_RUN,
    });

    const sourceRegistryResults = [];
    for (const row of sourceRegistry) {
      sourceRegistryResults.push(
        await upsertSmallDoc({
          collection: db.collection(SOURCE_REGISTRY_COLLECTION),
          filter: { source_id: row.source_id },
          doc: {
            ...row,
            package_id: packageId,
            imported_at: new Date().toISOString(),
          },
          dryRun: DRY_RUN,
        })
      );
    }

    const packageRegistryResult = await upsertSmallDoc({
      collection: db.collection(PACKAGE_REGISTRY_COLLECTION),
      filter: { package_id: packageId },
      doc: {
        ...packageManifest,
        manifest_path: packageManifestPath,
        imported_at: new Date().toISOString(),
      },
      dryRun: DRY_RUN,
    });

    const coverageResult = await upsertSmallDoc({
      collection: db.collection(COVERAGE_REPORTS_COLLECTION),
      filter: { package_id: packageId },
      doc: {
        package_id: packageId,
        coverage: coverageSummary,
        imported_at: new Date().toISOString(),
      },
      dryRun: DRY_RUN,
    });

    const report = {
      package: {
        package_id: packageId,
        package_dir: packageDir,
        package_manifest_path: packageManifestPath,
      },
      dryRun: DRY_RUN,
      db: {
        uri: MONGO_URI,
        name: CEI_DB_NAME,
      },
      input: {
        path: inputPath,
        rows_raw: inputRowsRaw.length,
        rows_normalized: normalizedRows.length,
      },
      collections: {
        rankings: RANKINGS_COLLECTION,
        source_registry: SOURCE_REGISTRY_COLLECTION,
        data_packages: PACKAGE_REGISTRY_COLLECTION,
        coverage_reports: COVERAGE_REPORTS_COLLECTION,
      },
      stats: {
        rankings: rankingStats,
        source_registry: sourceRegistryResults,
        package_registry: packageRegistryResult,
        coverage_reports: coverageResult,
      },
    };

    const reportPath = path.join(
      packageDir,
      `nirf_import_report_${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );
    writeJson(reportPath, report);

    console.log("\nNIRF IMPORT INTO CEI COMPLETE");
    console.log("Rankings total        :", rankingStats.totalDocs);
    console.log(
      "Rankings would/add    :",
      DRY_RUN ? rankingStats.wouldInsert : rankingStats.inserted
    );
    console.log(
      "Rankings update       :",
      DRY_RUN ? rankingStats.wouldUpdate : rankingStats.updated
    );
    console.log("Package dir           :", packageDir);
    console.log("Import report         :", reportPath);
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("NIRF IMPORT INTO CEI FAILED");
  console.error(err);
  process.exit(1);
});