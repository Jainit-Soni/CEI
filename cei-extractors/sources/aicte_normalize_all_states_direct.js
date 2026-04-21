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

const DEFAULT_ADMISSION_YEAR = 2025;

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function upper(text) {
  const s = clean(text);
  return s ? s.toUpperCase() : "";
}

function titleCase(text) {
  const s = clean(text).toLowerCase();
  if (!s) return "";
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

function getLatestAicteAllStatesManifestPath() {
  const files = listFiles(MANIFESTS_DIR)
    .filter((name) => name.startsWith("aicte_all_states_direct_") && name.endsWith(".json"))
    .sort();

  if (!files.length) {
    throw new Error("No aicte_all_states_direct manifest found.");
  }

  return path.join(MANIFESTS_DIR, files[files.length - 1]);
}

function buildStableKey(row) {
  return [
    row.source,
    row.admission_year,
    row.state_name,
    row.aicte_id,
    row.institute_name,
    row.address,
    row.district,
    row.institution_type,
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

function normalizeBooleanLike(value) {
  const s = upper(value);
  if (!s) return "";
  if (["Y", "YES", "TRUE", "1"].includes(s)) return "Y";
  if (["N", "NO", "FALSE", "0"].includes(s)) return "N";
  return s;
}

function normalizeStateName(state) {
  const s = clean(state);
  if (!s) return "";

  const map = {
    "Orissa": "Odisha",
    "Dadra and Nagar Haveli": "Dadra and Nagar Haveli",
    "Daman and Diu": "Daman and Diu",
    "Jammu and Kashmir": "Jammu and Kashmir",
    "Andaman and Nicobar Islands": "Andaman and Nicobar Islands",
  };

  return map[s] || titleCase(s);
}

function extractLinkish(value) {
  const s = clean(value);
  if (!s) return "";
  return s;
}

function normalizeRow(row, runId) {
  const stateName = normalizeStateName(row.state);
  const normalized = {
    source: "aicte_approved_institutes",
    extractor_scope: "all_states_direct",
    extractor_run_id: runId,

    admission_year: Number(clean(row.admission_year || DEFAULT_ADMISSION_YEAR)) || DEFAULT_ADMISSION_YEAR,

    state_name: stateName,
    state_value_raw: clean(row.state_value),

    program_filter_label: clean(row.program_filter),
    program_filter_value: clean(row.program_filter_value),

    level_filter_label: clean(row.level_filter),
    level_filter_value: clean(row.level_filter_value),

    institutiontype_filter_label: clean(row.institutiontype_filter),
    institutiontype_filter_value: clean(row.institutiontype_filter_value),

    women_filter_label: clean(row.women_filter),
    women_filter_value: clean(row.women_filter_value),

    minority_filter_label: clean(row.minority_filter),
    minority_filter_value: clean(row.minority_filter_value),

    course_filter_value: clean(row.course_filter),

    aicte_id: clean(row.aicte_id),
    institute_name: clean(row.name),
    address: clean(row.address),
    district: clean(row.district),
    institution_type: clean(row.institution_type),

    women_flag: normalizeBooleanLike(row.women),
    minority_flag: normalizeBooleanLike(row.minority),

    course_details_ref: extractLinkish(row.course_details),
    faculty_details_ref: extractLinkish(row.faculty_details),

    page_url: clean(row.page_url),
    extracted_at: clean(row.extracted_at),

    raw: clean(row.raw),
  };

  normalized.stable_key = buildStableKey(normalized);
  return normalized;
}

function summarize(rowsBeforeDedupe, rowsAfterDedupe) {
  const byState = {};
  const byInstitutionType = {};
  const byWomen = {};
  const byMinority = {};

  let blankAicteId = 0;
  let blankInstituteName = 0;
  let blankAddress = 0;
  let blankDistrict = 0;

  for (const row of rowsAfterDedupe) {
    byState[row.state_name || "(blank)"] = (byState[row.state_name || "(blank)"] || 0) + 1;
    byInstitutionType[row.institution_type || "(blank)"] =
      (byInstitutionType[row.institution_type || "(blank)"] || 0) + 1;
    byWomen[row.women_flag || "(blank)"] = (byWomen[row.women_flag || "(blank)"] || 0) + 1;
    byMinority[row.minority_flag || "(blank)"] =
      (byMinority[row.minority_flag || "(blank)"] || 0) + 1;

    if (!row.aicte_id) blankAicteId++;
    if (!row.institute_name) blankInstituteName++;
    if (!row.address) blankAddress++;
    if (!row.district) blankDistrict++;
  }

  const topN = (obj, n = 50) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));

  return {
    rows_before_dedupe: rowsBeforeDedupe.length,
    rows_after_dedupe: rowsAfterDedupe.length,
    duplicates_removed: rowsBeforeDedupe.length - rowsAfterDedupe.length,

    blank_aicte_id: blankAicteId,
    blank_institute_name: blankInstituteName,
    blank_address: blankAddress,
    blank_district: blankDistrict,

    state_distribution: topN(byState, 100),
    institution_type_distribution: topN(byInstitutionType, 100),
    women_distribution: topN(byWomen, 20),
    minority_distribution: topN(byMinority, 20),
  };
}

function rowsToCsv(rows) {
  const headers = [
    "source",
    "extractor_scope",
    "extractor_run_id",
    "admission_year",
    "state_name",
    "state_value_raw",
    "program_filter_label",
    "program_filter_value",
    "level_filter_label",
    "level_filter_value",
    "institutiontype_filter_label",
    "institutiontype_filter_value",
    "women_filter_label",
    "women_filter_value",
    "minority_filter_label",
    "minority_filter_value",
    "course_filter_value",
    "aicte_id",
    "institute_name",
    "address",
    "district",
    "institution_type",
    "women_flag",
    "minority_flag",
    "course_details_ref",
    "faculty_details_ref",
    "page_url",
    "extracted_at",
    "stable_key",
  ];

  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(headers.map((h) => {
      const s = String(row[h] ?? "");
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }).join(","));
  }

  return lines.join("\n");
}

async function main() {
  ensureDir(PARSED_DIR);

  const manifestPath = getLatestAicteAllStatesManifestPath();
  const manifest = readJson(manifestPath);
  const rawDir = manifest.rawDir;

  if (!rawDir || !fs.existsSync(rawDir)) {
    throw new Error(`Raw dir not found: ${rawDir}`);
  }

  const inputPath = path.join(rawDir, "combined_rows_progress.json");
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

  const jsonPath = path.join(PARSED_DIR, `aicte_all_states_normalized_${runId}.json`);
  const csvPath = path.join(PARSED_DIR, `aicte_all_states_normalized_${runId}.csv`);
  const qaPath = path.join(PARSED_DIR, `aicte_all_states_qa_${runId}.json`);

  writeJson(jsonPath, normalizedAfterDedupe);
  writeText(csvPath, rowsToCsv(normalizedAfterDedupe));
  writeJson(qaPath, {
    manifest_path: manifestPath,
    raw_dir: rawDir,
    input_path: inputPath,
    ...qaSummary,
  });

  console.log("\nAICTE NORMALIZATION COMPLETE");
  console.log("Rows before dedupe    :", normalizedBeforeDedupe.length);
  console.log("Rows after dedupe     :", normalizedAfterDedupe.length);
  console.log("Normalized JSON       :", jsonPath);
  console.log("Normalized CSV        :", csvPath);
  console.log("QA summary JSON       :", qaPath);
}

main().catch((err) => {
  console.error("AICTE NORMALIZATION FAILED");
  console.error(err);
  process.exit(1);
});