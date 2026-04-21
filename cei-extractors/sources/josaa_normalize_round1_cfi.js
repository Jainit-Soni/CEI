const fs = require("fs");
const path = require("path");

const {
  ensureDir,
  writeText,
  writeJson,
  listFiles,
  readJson,
} = require("../core/io");

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "cei-extractors", "output");
const MANIFESTS_DIR = path.join(OUTPUT_DIR, "manifests");
const PARSED_DIR = path.join(OUTPUT_DIR, "parsed");

// Change this if you later normalize a different counselling year.
const DEFAULT_ADMISSION_YEAR = 2025;

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getLatestJosaaRound1CfiManifestPath() {
  const files = listFiles(MANIFESTS_DIR)
    .filter((name) => name.startsWith("josaa_round1_cfi_") && name.endsWith(".json"))
    .sort();

  if (!files.length) {
    throw new Error("No josaa_round1_cfi manifest found.");
  }

  return path.join(MANIFESTS_DIR, files[files.length - 1]);
}

function toNullableInt(value) {
  const s = normalizeText(value);
  if (!s) return null;

  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;

  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function isPreparatoryRank(value) {
  return /p$/i.test(normalizeText(value));
}

function toUpperOrBlank(value) {
  const s = normalizeText(value);
  return s ? s.toUpperCase() : "";
}

function buildStableKey(row) {
  return [
    row.source,
    row.admission_year,
    row.round_no,
    row.institute_type_code,
    row.institute_code,
    row.program_code,
    row.selected_seat_filter_code,
    row.quota_code,
    row.seat_type_code,
    row.gender,
    row.opening_rank_raw,
    row.closing_rank_raw,
  ].join("||");
}

function dedupeRows(rows) {
  const seen = new Set();

  return rows.filter((row) => {
    const key = row.stable_key;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeRow(row, runId) {
  const openingRankRaw = normalizeText(row.opening_rank);
  const closingRankRaw = normalizeText(row.closing_rank);

  const normalized = {
    source: "josaa_orcr",
    extractor_scope: "round1_cfi_first10_institutes",
    extractor_run_id: runId,

    admission_year: DEFAULT_ADMISSION_YEAR,
    round_no: toNullableInt(row.round_value || row.round),
    round_label: normalizeText(row.round),

    institute_type_code: normalizeText(row.institute_type_value),
    institute_type_label: normalizeText(row.institute_type),

    institute_code: normalizeText(row.institute_name_value),
    institute_name: normalizeText(row.institute_name),

    program_code: normalizeText(row.program_value),
    program_name: normalizeText(row.program),

    selected_seat_filter_code: normalizeText(row.seat_type_value),
    selected_seat_filter_label: normalizeText(row.seat_type_selected),

    quota_code: toUpperOrBlank(row.quota),
    seat_type_code: toUpperOrBlank(row.seat_type),
    gender: normalizeText(row.gender),

    opening_rank_raw: openingRankRaw,
    closing_rank_raw: closingRankRaw,
    opening_rank_numeric: toNullableInt(openingRankRaw),
    closing_rank_numeric: toNullableInt(closingRankRaw),
    opening_rank_is_preparatory: isPreparatoryRank(openingRankRaw),
    closing_rank_is_preparatory: isPreparatoryRank(closingRankRaw),

    extraction_source: normalizeText(row.source),
    source_url: normalizeText(row.page_url),
    extracted_at: normalizeText(row.extracted_at),

    raw_line: normalizeText(row.raw_line),
  };

  normalized.stable_key = buildStableKey(normalized);
  return normalized;
}

function summarize(rowsBeforeDedupe, rowsAfterDedupe) {
  const byInstitute = {};
  const byProgram = {};
  const byQuota = {};
  const bySeatType = {};
  const byGender = {};

  let missingOpening = 0;
  let missingClosing = 0;
  let preparatoryOpening = 0;
  let preparatoryClosing = 0;

  let minOpening = null;
  let maxOpening = null;
  let minClosing = null;
  let maxClosing = null;

  for (const row of rowsAfterDedupe) {
    byInstitute[row.institute_name] = (byInstitute[row.institute_name] || 0) + 1;
    byProgram[row.program_name] = (byProgram[row.program_name] || 0) + 1;
    byQuota[row.quota_code || "(blank)"] = (byQuota[row.quota_code || "(blank)"] || 0) + 1;
    bySeatType[row.seat_type_code || "(blank)"] =
      (bySeatType[row.seat_type_code || "(blank)"] || 0) + 1;
    byGender[row.gender || "(blank)"] = (byGender[row.gender || "(blank)"] || 0) + 1;

    if (row.opening_rank_numeric == null) missingOpening++;
    if (row.closing_rank_numeric == null) missingClosing++;

    if (row.opening_rank_is_preparatory) preparatoryOpening++;
    if (row.closing_rank_is_preparatory) preparatoryClosing++;

    if (row.opening_rank_numeric != null) {
      minOpening =
        minOpening == null ? row.opening_rank_numeric : Math.min(minOpening, row.opening_rank_numeric);
      maxOpening =
        maxOpening == null ? row.opening_rank_numeric : Math.max(maxOpening, row.opening_rank_numeric);
    }

    if (row.closing_rank_numeric != null) {
      minClosing =
        minClosing == null ? row.closing_rank_numeric : Math.min(minClosing, row.closing_rank_numeric);
      maxClosing =
        maxClosing == null ? row.closing_rank_numeric : Math.max(maxClosing, row.closing_rank_numeric);
    }
  }

  const topN = (obj, n = 20) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));

  return {
    rows_before_dedupe: rowsBeforeDedupe.length,
    rows_after_dedupe: rowsAfterDedupe.length,
    duplicates_removed: rowsBeforeDedupe.length - rowsAfterDedupe.length,

    missing_opening_rank_numeric: missingOpening,
    missing_closing_rank_numeric: missingClosing,
    preparatory_opening_count: preparatoryOpening,
    preparatory_closing_count: preparatoryClosing,

    min_opening_rank_numeric: minOpening,
    max_opening_rank_numeric: maxOpening,
    min_closing_rank_numeric: minClosing,
    max_closing_rank_numeric: maxClosing,

    top_institutes: topN(byInstitute),
    top_programs: topN(byProgram),
    quota_distribution: topN(byQuota, 50),
    seat_type_distribution: topN(bySeatType, 50),
    gender_distribution: topN(byGender, 20),
  };
}

function rowsToCsv(rows) {
  const headers = [
    "source",
    "extractor_scope",
    "extractor_run_id",
    "admission_year",
    "round_no",
    "round_label",
    "institute_type_code",
    "institute_type_label",
    "institute_code",
    "institute_name",
    "program_code",
    "program_name",
    "selected_seat_filter_code",
    "selected_seat_filter_label",
    "quota_code",
    "seat_type_code",
    "gender",
    "opening_rank_raw",
    "closing_rank_raw",
    "opening_rank_numeric",
    "closing_rank_numeric",
    "opening_rank_is_preparatory",
    "closing_rank_is_preparatory",
    "extraction_source",
    "source_url",
    "extracted_at",
    "stable_key",
  ];

  const escape = (value) => {
    const s = String(value ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }

  return lines.join("\n");
}

async function main() {
  ensureDir(PARSED_DIR);

  const manifestPath = getLatestJosaaRound1CfiManifestPath();
  const manifest = readJson(manifestPath);
  const rawDir = manifest.rawDir;

  if (!rawDir || !fs.existsSync(rawDir)) {
    throw new Error(`Raw dir not found: ${rawDir}`);
  }

  const inputPath = path.join(rawDir, "round1_cfi_progress.json");
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  console.log("Using manifest:", manifestPath);
  console.log("Using raw dir  :", rawDir);
  console.log("Using input    :", inputPath);

  const inputRows = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const runId = path.basename(rawDir);

  const normalizedBeforeDedupe = inputRows.map((row) => normalizeRow(row, runId));
  const normalizedAfterDedupe = dedupeRows(normalizedBeforeDedupe);
  const qaSummary = summarize(normalizedBeforeDedupe, normalizedAfterDedupe);

  const jsonPath = path.join(PARSED_DIR, `josaa_round1_cfi_normalized_${runId}.json`);
  const csvPath = path.join(PARSED_DIR, `josaa_round1_cfi_normalized_${runId}.csv`);
  const qaPath = path.join(PARSED_DIR, `josaa_round1_cfi_qa_${runId}.json`);

  writeJson(jsonPath, normalizedAfterDedupe);
  writeText(csvPath, rowsToCsv(normalizedAfterDedupe));
  writeJson(qaPath, {
    manifest_path: manifestPath,
    raw_dir: rawDir,
    input_path: inputPath,
    ...qaSummary,
  });

  console.log("\nJOSAA NORMALIZATION COMPLETE");
  console.log("Rows before dedupe    :", normalizedBeforeDedupe.length);
  console.log("Rows after dedupe     :", normalizedAfterDedupe.length);
  console.log("Normalized JSON       :", jsonPath);
  console.log("Normalized CSV        :", csvPath);
  console.log("QA summary JSON       :", qaPath);
}

main().catch((err) => {
  console.error("JOSAA NORMALIZATION FAILED");
  console.error(err);
  process.exit(1);
});