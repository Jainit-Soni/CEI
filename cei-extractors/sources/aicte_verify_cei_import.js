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

const INSTITUTIONS_COLLECTION =
  process.env.CEI_INSTITUTIONS_COLLECTION || "institutions";
const COURSE_OFFERINGS_COLLECTION =
  process.env.CEI_COURSE_OFFERINGS_COLLECTION || "course_offerings";

const SEMANTIC_VERSION = process.env.SEMANTIC_VERSION || "aicte_semantics_v1";
const SAMPLE_LIMIT = Number(process.env.SAMPLE_LIMIT || 10);

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

function getLatestSemanticManifestPath() {
  const explicit = clean(process.env.SEMANTIC_MANIFEST);
  if (explicit) {
    if (!fs.existsSync(explicit)) {
      throw new Error(`SEMANTIC_MANIFEST does not exist: ${explicit}`);
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
  const semanticManifestPath = path.join(latestDir, "aicte_semantic_clean_manifest.json");

  if (!fs.existsSync(semanticManifestPath)) {
    throw new Error(`Semantic manifest not found: ${semanticManifestPath}`);
  }

  return semanticManifestPath;
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

  return map[raw] || raw;
}

async function countDocs(collection, query) {
  return await collection.countDocuments(query);
}

async function topByField(collection, match, field, limit = 20) {
  const rows = await collection
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: [`$${field}`, "(blank)"] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: limit },
    ])
    .toArray();

  return rows.map((r) => ({
    key: clean(r._id),
    count: r.count,
  }));
}

async function sampleInstitutionJoin(db) {
  const institutions = db.collection(INSTITUTIONS_COLLECTION);
  const courses = db.collection(COURSE_OFFERINGS_COLLECTION);

  const institution = await institutions.findOne(
    {
      source: "aicte",
      semantic_clean_version: SEMANTIC_VERSION,
    },
    {
      sort: { institution_id: 1 },
    }
  );

  if (!institution) {
    return {
      foundInstitution: false,
      institution: null,
      courseSamples: [],
    };
  }

  const courseSamples = await courses
    .find(
      {
        institution_id: institution.institution_id,
        source: "aicte",
        semantic_clean_version: SEMANTIC_VERSION,
      },
      {
        projection: {
          _id: 0,
          institution_id: 1,
          aicte_id: 1,
          course_name: 1,
          course_level: 1,
          intake: 1,
          mode: 1,
          shift: 1,
          course_variant_type: 1,
          state_name: 1,
        },
      }
    )
    .limit(SAMPLE_LIMIT)
    .toArray();

  return {
    foundInstitution: true,
    institution: {
      institution_id: clean(institution.institution_id),
      aicte_id: clean(institution.aicte_id),
      institution_name: clean(institution.institution_name),
      state_name: clean(institution.state_name),
      state_code: clean(institution.state_code),
    },
    courseSamples,
  };
}

async function countCourseRowsWithMissingInstitution(db) {
  const courses = db.collection(COURSE_OFFERINGS_COLLECTION);
  return await courses.countDocuments({
    source: "aicte",
    semantic_clean_version: SEMANTIC_VERSION,
    institute_match_found: { $ne: "Y" },
  });
}

async function countCourseRowsMissingSemanticFields(db) {
  const courses = db.collection(COURSE_OFFERINGS_COLLECTION);

  const modeMissing = await courses.countDocuments({
    source: "aicte",
    semantic_clean_version: SEMANTIC_VERSION,
    raw_mode_text: { $exists: true, $nin: ["", null] },
    $or: [{ mode: { $exists: false } }, { mode: "" }, { mode: null }],
  });

  const shiftMissing = await courses.countDocuments({
    source: "aicte",
    semantic_clean_version: SEMANTIC_VERSION,
    raw_shift_text: { $exists: true, $nin: ["", null] },
    $or: [{ shift: { $exists: false } }, { shift: "" }, { shift: null }],
  });

  const variantMissing = await courses.countDocuments({
    source: "aicte",
    semantic_clean_version: SEMANTIC_VERSION,
    course_type_original: { $exists: true, $nin: ["", null] },
    $or: [
      { course_variant_type: { $exists: false } },
      { course_variant_type: "" },
      { course_variant_type: null },
    ],
  });

  return {
    mode_missing_where_raw_present: modeMissing,
    shift_missing_where_raw_present: shiftMissing,
    course_variant_missing_where_raw_present: variantMissing,
  };
}

async function findStateJoinMismatches(db) {
  const courses = db.collection(COURSE_OFFERINGS_COLLECTION);

  const rawRows = await courses
    .find(
      {
        source: "aicte",
        semantic_clean_version: SEMANTIC_VERSION,
        linked_state_name: { $exists: true, $nin: ["", null] },
      },
      {
        projection: {
          _id: 0,
          aicte_id: 1,
          institution_id: 1,
          institution_name: 1,
          state_name: 1,
          linked_state_name: 1,
          course_name: 1,
        },
      }
    )
    .limit(1000)
    .toArray();

  const mismatches = rawRows.filter(
    (row) =>
      canonicalStateName(row.state_name) !== canonicalStateName(row.linked_state_name)
  );

  return {
    checked_rows: rawRows.length,
    mismatch_count: mismatches.length,
    mismatch_samples: mismatches.slice(0, SAMPLE_LIMIT),
  };
}

async function multiStateUniversityExamples(db) {
  const courses = db.collection(COURSE_OFFERINGS_COLLECTION);

  const rows = await courses
    .aggregate([
      {
        $match: {
          source: "aicte",
          semantic_clean_version: SEMANTIC_VERSION,
          university: { $exists: true, $nin: ["", null] },
          state_name: { $exists: true, $nin: ["", null] },
        },
      },
      {
        $group: {
          _id: "$university",
          states: { $addToSet: "$state_name" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          university: "$_id",
          state_count: { $size: "$states" },
          states: 1,
          count: 1,
        },
      },
      { $match: { state_count: { $gt: 1 } } },
      { $sort: { state_count: -1, count: -1, university: 1 } },
      { $limit: SAMPLE_LIMIT },
    ])
    .toArray();

  return rows.map((r) => ({
    university: clean(r.university),
    state_count: r.state_count,
    states: r.states.map(canonicalStateName),
    count: r.count,
  }));
}

async function verifyPackageCoverageAgainstDb(db, semanticManifest, packageManifest) {
  const institutionsExpected =
    semanticManifest.counts?.institutions ??
    packageManifest.counts?.institutions ??
    null;

  const coursesExpected =
    semanticManifest.counts?.courses ??
    packageManifest.counts?.courses ??
    null;

  const institutionsActual = await db.collection(INSTITUTIONS_COLLECTION).countDocuments({
    source: "aicte",
    semantic_clean_version: SEMANTIC_VERSION,
  });

  const coursesActual = await db.collection(COURSE_OFFERINGS_COLLECTION).countDocuments({
    source: "aicte",
    semantic_clean_version: SEMANTIC_VERSION,
  });

  return {
    expected: {
      institutions: institutionsExpected,
      courses: coursesExpected,
    },
    actual: {
      institutions: institutionsActual,
      courses: coursesActual,
    },
    matches: {
      institutions:
        institutionsExpected == null ? null : institutionsExpected === institutionsActual,
      courses:
        coursesExpected == null ? null : coursesExpected === coursesActual,
    },
  };
}

async function main() {
  const semanticManifestPath = getLatestSemanticManifestPath();
  const semanticManifest = readJson(semanticManifestPath);
  const packageManifestPath = semanticManifest.package_manifest_path;
  const packageManifest = readJson(packageManifestPath);

  console.log("Using semantic manifest:", semanticManifestPath);
  console.log("Using package manifest :", packageManifestPath);
  console.log("Mongo URI              :", MONGO_URI);
  console.log("CEI DB                 :", CEI_DB_NAME);
  console.log("Semantic version       :", SEMANTIC_VERSION);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(CEI_DB_NAME);

    const institutionsCollection = db.collection(INSTITUTIONS_COLLECTION);
    const coursesCollection = db.collection(COURSE_OFFERINGS_COLLECTION);

    const institutionCount = await countDocs(institutionsCollection, {
      source: "aicte",
      semantic_clean_version: SEMANTIC_VERSION,
    });

    const courseCount = await countDocs(coursesCollection, {
      source: "aicte",
      semantic_clean_version: SEMANTIC_VERSION,
    });

    const institutionStates = await topByField(
      institutionsCollection,
      { source: "aicte", semantic_clean_version: SEMANTIC_VERSION },
      "state_name",
      50
    );

    const courseStates = await topByField(
      coursesCollection,
      { source: "aicte", semantic_clean_version: SEMANTIC_VERSION },
      "state_name",
      50
    );

    const courseLevels = await topByField(
      coursesCollection,
      { source: "aicte", semantic_clean_version: SEMANTIC_VERSION },
      "course_level",
      50
    );

    const modes = await topByField(
      coursesCollection,
      { source: "aicte", semantic_clean_version: SEMANTIC_VERSION },
      "mode",
      20
    );

    const shifts = await topByField(
      coursesCollection,
      { source: "aicte", semantic_clean_version: SEMANTIC_VERSION },
      "shift",
      20
    );

    const joinSample = await sampleInstitutionJoin(db);
    const unmatchedCourseRows = await countCourseRowsWithMissingInstitution(db);
    const missingSemanticFields = await countCourseRowsMissingSemanticFields(db);
    const stateJoinMismatches = await findStateJoinMismatches(db);
    const multiStateUniversities = await multiStateUniversityExamples(db);
    const coverageCheck = await verifyPackageCoverageAgainstDb(
      db,
      semanticManifest,
      packageManifest
    );

    const report = {
      generated_at: new Date().toISOString(),
      db: {
        uri: MONGO_URI,
        name: CEI_DB_NAME,
      },
      manifests: {
        semantic_manifest_path: semanticManifestPath,
        package_manifest_path: packageManifestPath,
        semantic_version: SEMANTIC_VERSION,
      },
      counts: {
        institutions: institutionCount,
        courses: courseCount,
      },
      coverage_check: coverageCheck,
      top_distributions: {
        institution_states: institutionStates,
        course_states: courseStates,
        course_levels: courseLevels,
        modes,
        shifts,
      },
      join_verification: {
        unmatched_course_rows: unmatchedCourseRows,
        institution_join_sample: joinSample,
        state_join_mismatches: stateJoinMismatches,
      },
      semantic_field_verification: missingSemanticFields,
      review_candidates: {
        universities_in_multiple_states: multiStateUniversities,
      },
    };

    const packageDir = clean(packageManifest.package_dir);
    const outDir = packageDir && fs.existsSync(packageDir) ? packageDir : PARSED_DIR;
    const reportPath = path.join(
      outDir,
      `aicte_verify_cei_import_report_${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );

    writeJson(reportPath, report);

    console.log("\nAICTE VERIFY CEI IMPORT COMPLETE");
    console.log("Institutions count     :", institutionCount);
    console.log("Courses count          :", courseCount);
    console.log(
      "Coverage institutions  :",
      JSON.stringify(coverageCheck.matches.institutions)
    );
    console.log(
      "Coverage courses       :",
      JSON.stringify(coverageCheck.matches.courses)
    );
    console.log("Unmatched course rows  :", unmatchedCourseRows);
    console.log(
      "State join mismatches  :",
      stateJoinMismatches.mismatch_count
    );
    console.log(
      "Missing semantic fields:",
      JSON.stringify(missingSemanticFields)
    );
    console.log("QA report              :", reportPath);
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("AICTE VERIFY CEI IMPORT FAILED");
  console.error(err);
  process.exit(1);
});