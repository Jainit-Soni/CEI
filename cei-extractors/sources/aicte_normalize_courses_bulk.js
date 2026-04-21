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

function toNullableInt(value) {
  const s = clean(value);
  if (!s) return null;

  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;

  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function getLatestAicteCoursesManifestPath() {
  const files = listFiles(MANIFESTS_DIR)
    .filter((name) => name.startsWith("aicte_courses_bulk_") && name.endsWith(".json"))
    .sort();

  if (!files.length) {
    throw new Error("No aicte_courses_bulk manifest found.");
  }

  return path.join(MANIFESTS_DIR, files[files.length - 1]);
}

function normalizeStateName(state) {
  const s = clean(state);
  if (!s) return "";

  const map = {
    "Orissa": "Odisha",
    "Andaman and Nicobar Islands": "Andaman and Nicobar Islands",
    "Dadra and Nagar Haveli": "Dadra and Nagar Haveli",
    "Daman and Diu": "Daman and Diu",
    "Jammu and Kashmir": "Jammu and Kashmir",
  };

  return map[s] || titleCase(s);
}

function buildStableKey(row) {
  return [
    row.source,
    row.requested_year,
    row.aicte_id,
    row.parent_institute_name,
    row.programme,
    row.university,
    row.course_level,
    row.course_name,
    row.course_type,
    row.intake_raw,
    row.enrollment_raw,
    row.placement_raw,
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
  const normalized = {
    source: "aicte_approved_courses",
    extractor_scope: "bulk_direct",
    extractor_run_id: runId,

    requested_year: clean(row.requested_year),
    requested_course_arg: clean(row.requested_course_arg),

    state_name: normalizeStateName(row.state),
    state_value_raw: clean(row.state_value),

    aicte_id: clean(row.aicte_id),
    institute_name: clean(row.institute_name),
    parent_institute_name: clean(row.parent_institute_name || row.institute_name),
    institute_internal_id: clean(row.institute_internal_id),

    programme: clean(row.programme),
    university: clean(row.university),
    course_level: clean(row.course_level),
    course_name: clean(row.course_name),
    course_type: clean(row.course_type),

    intake_raw: clean(row.intake),
    enrollment_raw: clean(row.enrollment),
    placement_raw: clean(row.placement),

    intake_numeric: toNullableInt(row.intake),
    enrollment_numeric: toNullableInt(row.enrollment),
    placement_numeric: toNullableInt(row.placement),

    unknown_8: clean(row.unknown_8),
    unknown_9: clean(row.unknown_9),

    raw: clean(row.raw),
  };

  normalized.stable_key = buildStableKey(normalized);
  return normalized;
}

function summarize(rowsBeforeDedupe, rowsAfterDedupe) {
  const byState = {};
  const byLevel = {};
  const byCourseType = {};
  const byInstitute = {};

  let blankAicteId = 0;
  let blankCourseName = 0;
  let blankProgramme = 0;
  let blankUniversity = 0;
  let blankIntake = 0;
  let blankEnrollment = 0;
  let blankPlacement = 0;

  for (const row of rowsAfterDedupe) {
    byState[row.state_name || "(blank)"] = (byState[row.state_name || "(blank)"] || 0) + 1;
    byLevel[row.course_level || "(blank)"] = (byLevel[row.course_level || "(blank)"] || 0) + 1;
    byCourseType[row.course_type || "(blank)"] = (byCourseType[row.course_type || "(blank)"] || 0) + 1;
    byInstitute[row.parent_institute_name || "(blank)"] =
      (byInstitute[row.parent_institute_name || "(blank)"] || 0) + 1;

    if (!row.aicte_id) blankAicteId++;
    if (!row.course_name) blankCourseName++;
    if (!row.programme) blankProgramme++;
    if (!row.university) blankUniversity++;
    if (row.intake_numeric == null) blankIntake++;
    if (row.enrollment_numeric == null) blankEnrollment++;
    if (row.placement_numeric == null) blankPlacement++;
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
    blank_course_name: blankCourseName,
    blank_programme: blankProgramme,
    blank_university: blankUniversity,
    blank_intake_numeric: blankIntake,
    blank_enrollment_numeric: blankEnrollment,
    blank_placement_numeric: blankPlacement,

    state_distribution: topN(byState, 100),
    course_level_distribution: topN(byLevel, 50),
    course_type_distribution: topN(byCourseType, 100),
    top_institutes_by_course_rows: topN(byInstitute, 100),
  };
}

function rowsToCsv(rows) {
  const headers = [
    "source",
    "extractor_scope",
    "extractor_run_id",
    "requested_year",
    "requested_course_arg",
    "state_name",
    "state_value_raw",
    "aicte_id",
    "institute_name",
    "parent_institute_name",
    "institute_internal_id",
    "programme",
    "university",
    "course_level",
    "course_name",
    "course_type",
    "intake_raw",
    "enrollment_raw",
    "placement_raw",
    "intake_numeric",
    "enrollment_numeric",
    "placement_numeric",
    "unknown_8",
    "unknown_9",
    "stable_key",
  ];

  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const s = String(row[h] ?? "");
          if (s.includes('"') || s.includes(",") || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(",")
    );
  }

  return lines.join("\n");
}

async function main() {
  ensureDir(PARSED_DIR);

  const manifestPath = getLatestAicteCoursesManifestPath();
  const manifest = readJson(manifestPath);
  const rawDir = manifest.rawDir;

  if (!rawDir || !fs.existsSync(rawDir)) {
    throw new Error(`Raw dir not found: ${rawDir}`);
  }

  const inputPath = path.join(rawDir, "combined_course_rows_progress.json");
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

  const jsonPath = path.join(PARSED_DIR, `aicte_courses_normalized_${runId}.json`);
  const csvPath = path.join(PARSED_DIR, `aicte_courses_normalized_${runId}.csv`);
  const qaPath = path.join(PARSED_DIR, `aicte_courses_qa_${runId}.json`);

  writeJson(jsonPath, normalizedAfterDedupe);
  writeText(csvPath, rowsToCsv(normalizedAfterDedupe));
  writeJson(qaPath, {
    manifest_path: manifestPath,
    raw_dir: rawDir,
    input_path: inputPath,
    ...qaSummary,
  });

  console.log("\nAICTE COURSES NORMALIZATION COMPLETE");
  console.log("Rows before dedupe    :", normalizedBeforeDedupe.length);
  console.log("Rows after dedupe     :", normalizedAfterDedupe.length);
  console.log("Normalized JSON       :", jsonPath);
  console.log("Normalized CSV        :", csvPath);
  console.log("QA summary JSON       :", qaPath);
}

main().catch((err) => {
  console.error("AICTE COURSES NORMALIZATION FAILED");
  console.error(err);
  process.exit(1);
});