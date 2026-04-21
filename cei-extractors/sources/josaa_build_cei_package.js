const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const CEI_OUTPUT_DIR = path.join(ROOT, "cei-extractors", "output");
const CEI_PARSED_DIR = path.join(CEI_OUTPUT_DIR, "parsed");

const DEFAULT_INPUT = path.join(
  ROOT,
  "cei-extractors",
  "sources",
  "output",
  "josaa_orcr_all6_normalized.ndjson"
);

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function norm(text) {
  return clean(text).toLowerCase();
}

function safeName(text) {
  return clean(text)
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
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

function readNdjson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input NDJSON not found: ${filePath}`);
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const rows = [];
  let invalid = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      rows.push(JSON.parse(trimmed));
    } catch {
      invalid += 1;
    }
  }

  return { rows, invalid };
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) {
      out[arg.slice(2)] = "true";
    } else {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    }
  }
  return out;
}

function toNullableInt(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function topN(obj, n = 50) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

function dedupeByKey(rows, keyFn) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyFn(row);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildStableImportKey(row) {
  return [
    "josaa_cutoff",
    clean(row.counselling_year),
    clean(row.round_number),
    clean(row.institute_name_normalized),
    clean(row.program_name_raw),
    clean(row.quota_code),
    clean(row.local_category_label),
    clean(row.gender_pool_raw),
    clean(row.rank_basis),
  ].join("::");
}

function normalizeCategoryStatus(row) {
  const canonical = clean(row.canonical_category_label);
  if (!canonical) return "missing";
  if (canonical === "UNKNOWN") return "unknown";
  return "mapped";
}

function buildCutoffImportRow(row, inputPath) {
  const counsellingYear = toNullableInt(row.counselling_year);
  const roundNumber = toNullableInt(row.round_number);

  const doc = {
    source: "josaa",
    source_authority: "JOSAA",
    source_dataset: "orcr_cutoffs",
    source_record_type: "cutoff",
    source_extractor_scope: "all_rounds_all_filters_import_existing_normalized",
    source_input_path: inputPath,
    source_input_filename: path.basename(inputPath),

    authority: clean(row.authority),
    source_type: clean(row.source_type),

    academic_year: clean(row.academic_year),
    counselling_year: counsellingYear,
    round_number: roundNumber,
    round_label: clean(row.round_label),

    institute_name_raw: clean(row.institute_name_raw),
    institute_name_normalized: clean(row.institute_name_normalized),

    program_name_raw: clean(row.program_name_raw),
    program_title: clean(row.program_title),
    program_duration_years: toNullableInt(row.program_duration_years),
    degree_award: clean(row.degree_award),
    program_parse_status: clean(row.program_parse_status),

    quota_code: clean(row.quota_code),
    quota_canonical: clean(row.quota_canonical),

    local_category_label: clean(row.local_category_label),
    canonical_category_label: clean(row.canonical_category_label),
    category_mapping_status: normalizeCategoryStatus(row),
    is_pwd: Boolean(row.is_pwd),

    gender_pool_raw: clean(row.gender_pool_raw),
    gender_pool_canonical: clean(row.gender_pool_canonical),

    rank_basis: clean(row.rank_basis),

    opening_rank_raw: clean(row.opening_rank_raw),
    opening_rank: toNullableInt(row.opening_rank),
    opening_rank_preparatory: Boolean(row.opening_rank_preparatory),

    closing_rank_raw: clean(row.closing_rank_raw),
    closing_rank: toNullableInt(row.closing_rank),
    closing_rank_preparatory: Boolean(row.closing_rank_preparatory),

    source_url: clean(row.source_url),
    extracted_at: clean(row.extracted_at),

    entity_key: clean(row.entity_key),
    source_row_fingerprint: clean(row.source_row_fingerprint),

    provenance: row.provenance || null,
  };

  doc.stable_import_key = buildStableImportKey(doc);
  return doc;
}

function buildSourceRegistry({
  inputPath,
  packageDir,
  cutoffRows,
}) {
  const years = Array.from(
    new Set(cutoffRows.map((r) => clean(r.academic_year)).filter(Boolean))
  ).sort();

  return [
    {
      source_id: "josaa_orcr_cutoffs",
      authority: "JOSAA",
      source_type: "official_counselling_orcr",
      acquisition_method: "import_existing_normalized_ndjson",
      granularity: "cutoff",
      temporal_scope: years,
      row_count: cutoffRows.length,
      key_field: "stable_import_key",
      input_file: inputPath,
      package_dir: packageDir,
      notes:
        "JoSAA ORCR cutoffs imported from normalized NDJSON generated from all 6 rounds.",
    },
  ];
}

function buildCoverageSummary(cutoffRows, invalidLines) {
  const byRound = {};
  const byQuota = {};
  const byCategory = {};
  const byGenderPool = {};
  const byInstitute = {};
  const byProgramParseStatus = {};
  const byCategoryMappingStatus = {};

  let missingOpening = 0;
  let missingClosing = 0;
  let prepOpening = 0;
  let prepClosing = 0;

  for (const row of cutoffRows) {
    byRound[String(row.round_number || "(blank)")] =
      (byRound[String(row.round_number || "(blank)")] || 0) + 1;
    byQuota[row.quota_canonical || row.quota_code || "(blank)"] =
      (byQuota[row.quota_canonical || row.quota_code || "(blank)"] || 0) + 1;
    byCategory[row.canonical_category_label || row.local_category_label || "(blank)"] =
      (byCategory[row.canonical_category_label || row.local_category_label || "(blank)"] || 0) + 1;
    byGenderPool[row.gender_pool_canonical || row.gender_pool_raw || "(blank)"] =
      (byGenderPool[row.gender_pool_canonical || row.gender_pool_raw || "(blank)"] || 0) + 1;
    byInstitute[row.institute_name_normalized || "(blank)"] =
      (byInstitute[row.institute_name_normalized || "(blank)"] || 0) + 1;
    byProgramParseStatus[row.program_parse_status || "(blank)"] =
      (byProgramParseStatus[row.program_parse_status || "(blank)"] || 0) + 1;
    byCategoryMappingStatus[row.category_mapping_status || "(blank)"] =
      (byCategoryMappingStatus[row.category_mapping_status || "(blank)"] || 0) + 1;

    if (row.opening_rank == null) missingOpening += 1;
    if (row.closing_rank == null) missingClosing += 1;
    if (row.opening_rank_preparatory) prepOpening += 1;
    if (row.closing_rank_preparatory) prepClosing += 1;
  }

  return {
    total_rows: cutoffRows.length,
    invalid_lines_skipped: invalidLines,
    unique_institutes: new Set(cutoffRows.map((r) => r.institute_name_normalized)).size,
    unique_program_rows: new Set(
      cutoffRows.map((r) =>
        [
          r.institute_name_normalized,
          r.program_name_raw,
          r.quota_code,
          r.local_category_label,
          r.gender_pool_raw,
          r.round_number,
        ].join("||")
      )
    ).size,
    missing_opening_rank_rows: missingOpening,
    missing_closing_rank_rows: missingClosing,
    opening_preparatory_rows: prepOpening,
    closing_preparatory_rows: prepClosing,
    round_distribution: topN(byRound, 20),
    quota_distribution: topN(byQuota, 50),
    category_distribution: topN(byCategory, 50),
    gender_pool_distribution: topN(byGenderPool, 20),
    program_parse_status_distribution: topN(byProgramParseStatus, 20),
    category_mapping_status_distribution: topN(byCategoryMappingStatus, 20),
    top_institutes_by_rows: topN(byInstitute, 100),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = clean(args.in || process.env.JOSAA_INPUT || DEFAULT_INPUT);

  console.log("Using input:", inputPath);

  const { rows: rawRows, invalid: invalidLines } = readNdjson(inputPath);
  if (!rawRows.length) {
    throw new Error(`No rows found in input: ${inputPath}`);
  }

  const cutoffRows = dedupeByKey(
    rawRows.map((row) => buildCutoffImportRow(row, inputPath)),
    (row) => row.stable_import_key
  );

  const packageId = `josaa_cei_package_${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const packageDir = path.join(CEI_PARSED_DIR, packageId);
  ensureDir(packageDir);

  const cutoffsJsonPath = path.join(packageDir, "josaa_cutoffs_import_ready.json");
  const cutoffsCsvPath = path.join(packageDir, "josaa_cutoffs_import_ready.csv");
  const registryPath = path.join(packageDir, "josaa_source_registry.json");
  const coveragePath = path.join(packageDir, "josaa_coverage_summary.json");
  const manifestPath = path.join(packageDir, "josaa_package_manifest.json");

  const registry = buildSourceRegistry({
    inputPath,
    packageDir,
    cutoffRows,
  });

  const coverage = buildCoverageSummary(cutoffRows, invalidLines);

  const manifest = {
    package_id: packageId,
    package_dir: packageDir,
    inputs: {
      cutoffs_ndjson: inputPath,
    },
    outputs: {
      cutoffs_json: cutoffsJsonPath,
      cutoffs_csv: cutoffsCsvPath,
      source_registry_json: registryPath,
      coverage_summary_json: coveragePath,
    },
    counts: {
      cutoffs: cutoffRows.length,
    },
  };

  writeJson(cutoffsJsonPath, cutoffRows);
  writeText(cutoffsCsvPath, rowsToCsv(cutoffRows));
  writeJson(registryPath, registry);
  writeJson(coveragePath, coverage);
  writeJson(manifestPath, manifest);

  console.log("\nJOSAA CEI PACKAGE BUILD COMPLETE");
  console.log("Rows read            :", rawRows.length);
  console.log("Rows packaged        :", cutoffRows.length);
  console.log("Invalid lines skipped:", invalidLines);
  console.log("Package dir          :", packageDir);
  console.log("Cutoffs JSON         :", cutoffsJsonPath);
  console.log("Cutoffs CSV          :", cutoffsCsvPath);
  console.log("Source registry JSON :", registryPath);
  console.log("Coverage summary JSON:", coveragePath);
  console.log("Package manifest JSON:", manifestPath);
}

main().catch((err) => {
  console.error("JOSAA CEI PACKAGE BUILD FAILED");
  console.error(err);
  process.exit(1);
});