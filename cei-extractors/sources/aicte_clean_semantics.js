const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "cei-extractors", "output");
const PARSED_DIR = path.join(OUTPUT_DIR, "parsed");

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function upper(text) {
  return clean(text).toUpperCase();
}

function snake(text) {
  return clean(text)
    .replace(/&/g, " AND ")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function listDir(dirPath) {
  return fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : [];
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

function getLatestPackageManifestPath() {
  const explicit = clean(process.env.PACKAGE_MANIFEST);
  if (explicit) {
    if (!fs.existsSync(explicit)) {
      throw new Error(`PACKAGE_MANIFEST does not exist: ${explicit}`);
    }
    return explicit;
  }

  const dirs = listDir(PARSED_DIR)
    .filter((name) => name.startsWith("aicte_cei_package_"))
    .sort();

  if (!dirs.length) {
    throw new Error("No aicte_cei_package_* directory found.");
  }

  const latestDir = path.join(PARSED_DIR, dirs[dirs.length - 1]);
  const manifestPath = path.join(latestDir, "aicte_package_manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Package manifest not found: ${manifestPath}`);
  }

  return manifestPath;
}

function validatePackageManifest(manifest) {
  if (!manifest.outputs) {
    throw new Error("Package manifest missing outputs.");
  }

  const keys = [
    "institutions_json",
    "courses_json",
  ];

  for (const key of keys) {
    const filePath = manifest.outputs[key];
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Missing package output: ${key} -> ${filePath}`);
    }
  }
}

function canonicalStateName(value) {
  const raw = clean(value);
  if (!raw) return "";

  const map = {
    "Andaman And Nicobar Islands": "Andaman and Nicobar Islands",
    "Andaman and Nicobar Islands": "Andaman and Nicobar Islands",
    "Arunachal Pradesh": "Arunachal Pradesh",
    "Andhra Pradesh": "Andhra Pradesh",
    "Assam": "Assam",
    "Bihar": "Bihar",
    "Chandigarh": "Chandigarh",
    "Chhattisgarh": "Chhattisgarh",
    "Dadra and Nagar Haveli": "Dadra and Nagar Haveli",
    "Daman and Diu": "Daman and Diu",
    "Delhi": "Delhi",
    "Goa": "Goa",
    "Gujarat": "Gujarat",
    "Haryana": "Haryana",
    "Himachal Pradesh": "Himachal Pradesh",
    "Jammu And Kashmir": "Jammu and Kashmir",
    "Jammu and Kashmir": "Jammu and Kashmir",
    "Jharkhand": "Jharkhand",
    "Karnataka": "Karnataka",
    "Kerala": "Kerala",
    "Madhya Pradesh": "Madhya Pradesh",
    "Maharashtra": "Maharashtra",
    "Manipur": "Manipur",
    "Meghalaya": "Meghalaya",
    "Mizoram": "Mizoram",
    "Nagaland": "Nagaland",
    "Odisha": "Odisha",
    "Orissa": "Odisha",
    "Puducherry": "Puducherry",
    "Punjab": "Punjab",
    "Rajasthan": "Rajasthan",
    "Sikkim": "Sikkim",
    "Tamil Nadu": "Tamil Nadu",
    "Telangana": "Telangana",
    "Tripura": "Tripura",
    "Uttar Pradesh": "Uttar Pradesh",
    "Uttarakhand": "Uttarakhand",
    "West Bengal": "West Bengal",
  };

  if (map[raw]) return map[raw];

  // Fallback title casing but preserve "and"
  const titled = raw
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\bAnd\b/g, "and");

  return titled;
}

function stateCodeFromName(value) {
  const map = {
    "Andaman and Nicobar Islands": "AN",
    "Andhra Pradesh": "AP",
    "Arunachal Pradesh": "AR",
    "Assam": "AS",
    "Bihar": "BR",
    "Chandigarh": "CH",
    "Chhattisgarh": "CG",
    "Dadra and Nagar Haveli": "DN",
    "Daman and Diu": "DD",
    "Delhi": "DL",
    "Goa": "GA",
    "Gujarat": "GJ",
    "Haryana": "HR",
    "Himachal Pradesh": "HP",
    "Jammu and Kashmir": "JK",
    "Jharkhand": "JH",
    "Karnataka": "KA",
    "Kerala": "KL",
    "Madhya Pradesh": "MP",
    "Maharashtra": "MH",
    "Manipur": "MN",
    "Meghalaya": "ML",
    "Mizoram": "MZ",
    "Nagaland": "NL",
    "Odisha": "OD",
    "Puducherry": "PY",
    "Punjab": "PB",
    "Rajasthan": "RJ",
    "Sikkim": "SK",
    "Tamil Nadu": "TN",
    "Telangana": "TS",
    "Tripura": "TR",
    "Uttar Pradesh": "UP",
    "Uttarakhand": "UK",
    "West Bengal": "WB",
  };

  return map[canonicalStateName(value)] || "";
}

function normalizeMode(raw) {
  const s = upper(raw);
  if (!s) return "";

  if (s.includes("FULL") && s.includes("TIME")) return "FULL_TIME";
  if (s.includes("PART") && s.includes("TIME")) return "PART_TIME";
  if (s.includes("ONLINE")) return "ONLINE";
  if (s.includes("DISTANCE")) return "DISTANCE";
  if (s.includes("ODL")) return "ODL";

  return snake(s);
}

function normalizeShift(raw) {
  const s = upper(raw);
  if (!s) return "";

  const m = s.match(/(\d+)(ST|ND|RD|TH)\s+SHIFT/);
  if (m) return `${m[1]}_SHIFT`;

  if (s.includes("SHIFT")) return snake(s);

  return "";
}

function normalizeCourseVariantType(raw) {
  const s = upper(raw);
  if (!s) return "";

  if (s.startsWith("COURSE INSTITUTE")) return "COURSE_INSTITUTE";
  if (s.startsWith("COURSE")) return "COURSE";
  if (s.includes("MERGER")) return "MERGER";
  if (s.includes("LATERAL")) return "LATERAL";
  if (s.includes("INTEGRATED")) return "INTEGRATED";

  return snake(s);
}

function normalizeDeliveryPattern(mode, shift) {
  if (!mode && !shift) return "";
  if (mode && shift) return `${mode}__${shift}`;
  return mode || shift;
}

function cleanInstitutionRow(row) {
  const canonicalState = canonicalStateName(row.state_name);

  return {
    ...row,
    state_name_original: clean(row.state_name),
    state_name: canonicalState,
    state_code: stateCodeFromName(canonicalState),
    semantic_version: "aicte_semantics_v1",
  };
}

function cleanCourseRow(row) {
  const canonicalState = canonicalStateName(row.state_name);
  const mode = normalizeMode(row.raw_extra_9);
  const shift = normalizeShift(row.raw_extra_8);
  const courseVariantType = normalizeCourseVariantType(row.course_type);

  return {
    ...row,
    state_name_original: clean(row.state_name),
    state_name: canonicalState,
    state_code: stateCodeFromName(canonicalState),

    course_type_original: clean(row.course_type),
    course_variant_type: courseVariantType,

    raw_shift_text: clean(row.raw_extra_8),
    raw_mode_text: clean(row.raw_extra_9),
    shift: shift,
    mode: mode,
    delivery_pattern: normalizeDeliveryPattern(mode, shift),

    semantic_version: "aicte_semantics_v1",
  };
}

function buildQa(cleanedInstitutions, cleanedCourses) {
  const institutionStates = {};
  const courseStates = {};
  const courseVariants = {};
  const modes = {};
  const shifts = {};
  const unmatchedModes = {};
  const unmatchedShifts = {};

  for (const row of cleanedInstitutions) {
    institutionStates[row.state_name || "(blank)"] =
      (institutionStates[row.state_name || "(blank)"] || 0) + 1;
  }

  for (const row of cleanedCourses) {
    courseStates[row.state_name || "(blank)"] =
      (courseStates[row.state_name || "(blank)"] || 0) + 1;
    courseVariants[row.course_variant_type || "(blank)"] =
      (courseVariants[row.course_variant_type || "(blank)"] || 0) + 1;
    modes[row.mode || "(blank)"] =
      (modes[row.mode || "(blank)"] || 0) + 1;
    shifts[row.shift || "(blank)"] =
      (shifts[row.shift || "(blank)"] || 0) + 1;

    if (!row.mode && clean(row.raw_mode_text)) {
      unmatchedModes[clean(row.raw_mode_text)] =
        (unmatchedModes[clean(row.raw_mode_text)] || 0) + 1;
    }

    if (!row.shift && clean(row.raw_shift_text)) {
      unmatchedShifts[clean(row.raw_shift_text)] =
        (unmatchedShifts[clean(row.raw_shift_text)] || 0) + 1;
    }
  }

  return {
    institutions_count: cleanedInstitutions.length,
    courses_count: cleanedCourses.length,
    institution_state_distribution: topN(institutionStates, 100),
    course_state_distribution: topN(courseStates, 100),
    course_variant_type_distribution: topN(courseVariants, 100),
    mode_distribution: topN(modes, 50),
    shift_distribution: topN(shifts, 50),
    unmatched_raw_mode_texts: topN(unmatchedModes, 50),
    unmatched_raw_shift_texts: topN(unmatchedShifts, 50),
  };
}

function topN(obj, n = 50) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

async function main() {
  const packageManifestPath = getLatestPackageManifestPath();
  const packageManifest = readJson(packageManifestPath);
  validatePackageManifest(packageManifest);

  const packageDir = packageManifest.package_dir;
  if (!packageDir || !fs.existsSync(packageDir)) {
    throw new Error(`Package dir not found: ${packageDir}`);
  }

  const institutionsInputPath = packageManifest.outputs.institutions_json;
  const coursesInputPath = packageManifest.outputs.courses_json;

  const institutionsInput = readJson(institutionsInputPath);
  const coursesInput = readJson(coursesInputPath);

  console.log("Using package manifest:", packageManifestPath);
  console.log("Using package dir     :", packageDir);
  console.log("Institutions input    :", institutionsInputPath);
  console.log("Courses input         :", coursesInputPath);

  const cleanedInstitutions = institutionsInput.map(cleanInstitutionRow);
  const cleanedCourses = coursesInput.map(cleanCourseRow);

  const qa = buildQa(cleanedInstitutions, cleanedCourses);

  const institutionsJsonPath = path.join(
    packageDir,
    "aicte_institutions_import_ready_semantic_clean.json"
  );
  const institutionsCsvPath = path.join(
    packageDir,
    "aicte_institutions_import_ready_semantic_clean.csv"
  );
  const coursesJsonPath = path.join(
    packageDir,
    "aicte_course_offerings_import_ready_semantic_clean.json"
  );
  const coursesCsvPath = path.join(
    packageDir,
    "aicte_course_offerings_import_ready_semantic_clean.csv"
  );
  const qaPath = path.join(
    packageDir,
    "aicte_semantic_clean_qa.json"
  );
  const manifestOutPath = path.join(
    packageDir,
    "aicte_semantic_clean_manifest.json"
  );

  writeJson(institutionsJsonPath, cleanedInstitutions);
  writeText(institutionsCsvPath, rowsToCsv(cleanedInstitutions));
  writeJson(coursesJsonPath, cleanedCourses);
  writeText(coursesCsvPath, rowsToCsv(cleanedCourses));
  writeJson(qaPath, qa);
  writeJson(manifestOutPath, {
    semantic_version: "aicte_semantics_v1",
    package_manifest_path: packageManifestPath,
    inputs: {
      institutions_json: institutionsInputPath,
      courses_json: coursesInputPath,
    },
    outputs: {
      institutions_json: institutionsJsonPath,
      institutions_csv: institutionsCsvPath,
      courses_json: coursesJsonPath,
      courses_csv: coursesCsvPath,
      qa_json: qaPath,
    },
    counts: {
      institutions: cleanedInstitutions.length,
      courses: cleanedCourses.length,
    },
  });

  console.log("\nAICTE SEMANTIC CLEAN COMPLETE");
  console.log("Institutions JSON     :", institutionsJsonPath);
  console.log("Institutions CSV      :", institutionsCsvPath);
  console.log("Courses JSON          :", coursesJsonPath);
  console.log("Courses CSV           :", coursesCsvPath);
  console.log("QA JSON               :", qaPath);
  console.log("Semantic manifest     :", manifestOutPath);
}

main().catch((err) => {
  console.error("AICTE SEMANTIC CLEAN FAILED");
  console.error(err);
  process.exit(1);
});