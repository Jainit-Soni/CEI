const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  ensureDir,
  writeText,
  writeJson,
  listFiles,
  readJson,
} = require("../core/io");

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "cei-extractors", "output");
const PARSED_DIR = path.join(OUTPUT_DIR, "parsed");

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function norm(text) {
  return clean(text).toLowerCase();
}

function toNullableInt(value) {
  const s = clean(value);
  if (!s) return null;

  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;

  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function titleCase(text) {
  const s = clean(text).toLowerCase();
  if (!s) return "";
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

function shortHash(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 16);
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

function topN(obj, n = 50) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

function getLatestParsedFile(prefix) {
  const files = listFiles(PARSED_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .sort();

  if (!files.length) {
    throw new Error(`No parsed file found with prefix: ${prefix}`);
  }

  return path.join(PARSED_DIR, files[files.length - 1]);
}

function deriveYearLabelFromAdmissionYear(admissionYear) {
  const y = Number(admissionYear);
  if (!Number.isFinite(y)) return "";
  return `${y}-${y + 1}`;
}

function normalizeStateName(state) {
  const s = clean(state);
  if (!s) return "";

  const aliases = {
    Orissa: "Odisha",
  };

  return aliases[s] || titleCase(s);
}

function dedupeByKey(rows, keyFn) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyFn(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildInstitutionImportRow(row) {
  const institutionId = `aicte:${clean(row.aicte_id)}`;
  const admissionYear = toNullableInt(row.admission_year);

  return {
    source: "aicte",
    source_record_type: "institution",
    source_authority: "AICTE",
    source_dataset: "approved_institutes",
    institution_id: institutionId,
    stable_import_key: `aicte_institution::${clean(row.aicte_id)}`,
    aicte_id: clean(row.aicte_id),

    institution_name: clean(row.institute_name),
    state_name: normalizeStateName(row.state_name || row.state),
    district: clean(row.district),
    address: clean(row.address),
    institution_type: clean(row.institution_type),

    women_flag: clean(row.women_flag),
    minority_flag: clean(row.minority_flag),
    is_women_flagged: clean(row.women_flag) === "Y" ? "Y" : "N",
    is_minority_flagged: clean(row.minority_flag) === "Y" ? "Y" : "N",

    admission_year: admissionYear,
    approval_cycle_label: deriveYearLabelFromAdmissionYear(admissionYear),

    source_page_url: clean(row.page_url),
    extracted_at: clean(row.extracted_at),
    source_extractor_run_id: clean(row.extractor_run_id),
    source_extractor_scope: clean(row.extractor_scope),

    course_details_ref: clean(row.course_details_ref),
    faculty_details_ref: clean(row.faculty_details_ref),

    state_value_raw: clean(row.state_value_raw),
    institutiontype_filter_label: clean(row.institutiontype_filter_label),
    institutiontype_filter_value: clean(row.institutiontype_filter_value),
    women_filter_label: clean(row.women_filter_label),
    women_filter_value: clean(row.women_filter_value),
    minority_filter_label: clean(row.minority_filter_label),
    minority_filter_value: clean(row.minority_filter_value),
    course_filter_value: clean(row.course_filter_value),

    source_stable_key: clean(row.stable_key),
  };
}

function buildCourseImportRow(row, instituteMap) {
  const aicteId = clean(row.aicte_id);
  const institutionId = `aicte:${aicteId}`;
  const institute = instituteMap.get(aicteId);

  const yearLabel = clean(row.requested_year);
  const yearStart = /^\d{4}-\d{4}$/.test(yearLabel) ? Number(yearLabel.slice(0, 4)) : null;

  const stableKey = clean(row.stable_key) || [
    aicteId,
    clean(row.parent_institute_name),
    clean(row.programme),
    clean(row.university),
    clean(row.course_level),
    clean(row.course_name),
    clean(row.course_type),
    clean(row.intake_raw),
    clean(row.enrollment_raw),
    clean(row.placement_raw),
    yearLabel,
  ].join("||");

  return {
    source: "aicte",
    source_record_type: "course_offering",
    source_authority: "AICTE",
    source_dataset: "approved_courses",

    institution_id: institutionId,
    stable_import_key: `aicte_course::${shortHash(stableKey)}`,
    aicte_id: aicteId,

    institution_name: clean(row.parent_institute_name || row.institute_name),
    linked_institution_name: institute ? clean(institute.institution_name) : "",
    linked_state_name: institute ? clean(institute.state_name) : "",
    institute_match_found: institute ? "Y" : "N",

    requested_year_label: yearLabel,
    requested_year_start: yearStart,
    requested_course_arg: clean(row.requested_course_arg),

    state_name: normalizeStateName(row.state_name || row.state),
    programme: clean(row.programme),
    university: clean(row.university),
    course_level: clean(row.course_level),
    course_name: clean(row.course_name),
    course_type: clean(row.course_type),

    intake: toNullableInt(row.intake_numeric ?? row.intake_raw),
    enrollment: toNullableInt(row.enrollment_numeric ?? row.enrollment_raw),
    placement: toNullableInt(row.placement_numeric ?? row.placement_raw),

    intake_raw: clean(row.intake_raw),
    enrollment_raw: clean(row.enrollment_raw),
    placement_raw: clean(row.placement_raw),

    institute_internal_id: clean(row.institute_internal_id),
    raw_extra_8: clean(row.unknown_8),
    raw_extra_9: clean(row.unknown_9),

    source_extractor_run_id: clean(row.extractor_run_id),
    source_extractor_scope: clean(row.extractor_scope),
    source_stable_key: clean(row.stable_key),
  };
}

function buildSourceRegistry({
  instituteInputPath,
  courseInputPath,
  institutions,
  courses,
  packageDir,
}) {
  const institutionYears = Array.from(
    new Set(institutions.map((r) => clean(r.approval_cycle_label)).filter(Boolean))
  ).sort();

  const courseYears = Array.from(
    new Set(courses.map((r) => clean(r.requested_year_label)).filter(Boolean))
  ).sort();

  return [
    {
      source_id: "aicte_approved_institutes",
      authority: "AICTE",
      source_type: "regulatory_registry",
      acquisition_method: "playwright_filter_resolution_plus_direct_endpoint_fetch",
      granularity: "institution",
      temporal_scope: institutionYears,
      row_count: institutions.length,
      key_field: "aicte_id",
      input_file: instituteInputPath,
      package_dir: packageDir,
      notes: "Institute-level approved institutions extracted from approvedinstituteserver.php",
    },
    {
      source_id: "aicte_approved_courses",
      authority: "AICTE",
      source_type: "regulatory_registry",
      acquisition_method: "bulk_direct_endpoint_fetch",
      granularity: "course_offering",
      temporal_scope: courseYears,
      row_count: courses.length,
      key_field: "stable_import_key",
      join_field_to_institutions: "aicte_id",
      input_file: courseInputPath,
      package_dir: packageDir,
      notes: "Course-level approved offerings extracted from approvedcourse.php",
    },
  ];
}

function buildCoverageSummary(institutions, courses) {
  const byInstitutionState = {};
  const byCourseState = {};
  const byInstitutionType = {};
  const byCourseLevel = {};
  const byCourseType = {};

  const institutionIds = new Set();
  const institutionIdsWithCourses = new Set();
  let coursesMatched = 0;
  let coursesUnmatched = 0;

  for (const row of institutions) {
    institutionIds.add(row.aicte_id);
    byInstitutionState[row.state_name || "(blank)"] =
      (byInstitutionState[row.state_name || "(blank)"] || 0) + 1;
    byInstitutionType[row.institution_type || "(blank)"] =
      (byInstitutionType[row.institution_type || "(blank)"] || 0) + 1;
  }

  for (const row of courses) {
    byCourseState[row.state_name || "(blank)"] =
      (byCourseState[row.state_name || "(blank)"] || 0) + 1;
    byCourseLevel[row.course_level || "(blank)"] =
      (byCourseLevel[row.course_level || "(blank)"] || 0) + 1;
    byCourseType[row.course_type || "(blank)"] =
      (byCourseType[row.course_type || "(blank)"] || 0) + 1;

    if (row.institute_match_found === "Y") {
      coursesMatched++;
      institutionIdsWithCourses.add(row.aicte_id);
    } else {
      coursesUnmatched++;
    }
  }

  return {
    institutions_total_rows: institutions.length,
    institutions_unique_aicte_ids: institutionIds.size,
    courses_total_rows: courses.length,
    courses_matched_to_institutions: coursesMatched,
    courses_unmatched_to_institutions: coursesUnmatched,
    institutions_with_courses: institutionIdsWithCourses.size,
    institutions_without_courses: institutionIds.size - institutionIdsWithCourses.size,

    institution_state_distribution: topN(byInstitutionState, 100),
    course_state_distribution: topN(byCourseState, 100),
    institution_type_distribution: topN(byInstitutionType, 100),
    course_level_distribution: topN(byCourseLevel, 100),
    course_type_distribution: topN(byCourseType, 100),
  };
}

async function main() {
  ensureDir(PARSED_DIR);

  const instituteInputPath = getLatestParsedFile("aicte_all_states_normalized_");
  const courseInputPath = getLatestParsedFile("aicte_courses_normalized_");

  const instituteRowsRaw = readJson(instituteInputPath);
  const courseRowsRaw = readJson(courseInputPath);

  console.log("Using institute input:", instituteInputPath);
  console.log("Using course input   :", courseInputPath);

  const institutions = dedupeByKey(
    instituteRowsRaw.map(buildInstitutionImportRow),
    (row) => row.stable_import_key
  );

  const instituteMap = new Map(institutions.map((row) => [row.aicte_id, row]));

  const courses = dedupeByKey(
    courseRowsRaw.map((row) => buildCourseImportRow(row, instituteMap)),
    (row) => row.stable_import_key
  );

  const registry = buildSourceRegistry({
    instituteInputPath,
    courseInputPath,
    institutions,
    courses,
    packageDir: "",
  });

  const coverage = buildCoverageSummary(institutions, courses);

  const packageId = `aicte_cei_package_${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const packageDir = path.join(PARSED_DIR, packageId);
  ensureDir(packageDir);

  const institutionsJsonPath = path.join(packageDir, "aicte_institutions_import_ready.json");
  const institutionsCsvPath = path.join(packageDir, "aicte_institutions_import_ready.csv");
  const coursesJsonPath = path.join(packageDir, "aicte_course_offerings_import_ready.json");
  const coursesCsvPath = path.join(packageDir, "aicte_course_offerings_import_ready.csv");
  const sourceRegistryPath = path.join(packageDir, "aicte_source_registry.json");
  const coveragePath = path.join(packageDir, "aicte_coverage_summary.json");
  const manifestPath = path.join(packageDir, "aicte_package_manifest.json");

  const registryFinal = buildSourceRegistry({
    instituteInputPath,
    courseInputPath,
    institutions,
    courses,
    packageDir,
  });

  writeJson(institutionsJsonPath, institutions);
  writeText(institutionsCsvPath, rowsToCsv(institutions));
  writeJson(coursesJsonPath, courses);
  writeText(coursesCsvPath, rowsToCsv(courses));
  writeJson(sourceRegistryPath, registryFinal);
  writeJson(coveragePath, coverage);
  writeJson(manifestPath, {
    package_id: packageId,
    package_dir: packageDir,
    inputs: {
      institutes: instituteInputPath,
      courses: courseInputPath,
    },
    outputs: {
      institutions_json: institutionsJsonPath,
      institutions_csv: institutionsCsvPath,
      courses_json: coursesJsonPath,
      courses_csv: coursesCsvPath,
      source_registry_json: sourceRegistryPath,
      coverage_summary_json: coveragePath,
    },
    counts: {
      institutions: institutions.length,
      courses: courses.length,
    },
  });

  console.log("\nAICTE CEI PACKAGE BUILD COMPLETE");
  console.log("Package dir           :", packageDir);
  console.log("Institutions JSON     :", institutionsJsonPath);
  console.log("Institutions CSV      :", institutionsCsvPath);
  console.log("Courses JSON          :", coursesJsonPath);
  console.log("Courses CSV           :", coursesCsvPath);
  console.log("Source registry JSON  :", sourceRegistryPath);
  console.log("Coverage summary JSON :", coveragePath);
  console.log("Package manifest JSON :", manifestPath);
}

main().catch((err) => {
  console.error("AICTE CEI PACKAGE BUILD FAILED");
  console.error(err);
  process.exit(1);
});