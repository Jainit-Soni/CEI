const fs = require("fs");
const path = require("path");

const { fetchUrl } = require("../core/http");
const {
  ensureDir,
  writeText,
  writeJson,
  listFiles,
  readJson,
  safeName,
} = require("../core/io");

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "cei-extractors", "output");
const MANIFESTS_DIR = path.join(OUTPUT_DIR, "manifests");
const PARSED_DIR = path.join(OUTPUT_DIR, "parsed");

const AICTE_BASE = "https://facilities.aicte-india.org/dashboard/pages/";
const APPROVED_INSTITUTES_ENDPOINT =
  `${AICTE_BASE}php/approvedinstituteserver.php?method=fetchdata`;
const APPROVED_COURSE_ENDPOINT =
  `${AICTE_BASE}php/approvedcourse.php?method=fetchdata`;
const FACULTY_ENDPOINT =
  `${AICTE_BASE}php/faculty.php?method=fetchdata`;

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getLatestAicteProbeManifestPath() {
  const files = listFiles(MANIFESTS_DIR)
    .filter((name) => name.startsWith("aicte_probe_approved_dashboard_") && name.endsWith(".json"))
    .sort();

  if (!files.length) {
    throw new Error("No AICTE probe manifest found.");
  }

  return path.join(MANIFESTS_DIR, files[files.length - 1]);
}

function findParsedFile(prefix, runId) {
  const target = `${prefix}_${runId}.json`;
  const filePath = path.join(PARSED_DIR, target);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Parsed file not found: ${filePath}`);
  }
  return filePath;
}

function chooseOption(select, { preferAll = false } = {}) {
  const options = (select?.options || []).map((o) => ({
    value: clean(o.value),
    text: clean(o.text),
  }));

  if (preferAll) {
    const allOpt = options.find(
      (o) =>
        /^--all--$/i.test(o.text) ||
        /^all$/i.test(o.text) ||
        o.value === "1"
    );
    if (allOpt) return allOpt;
  }

  for (const opt of options) {
    if (!opt.value && !opt.text) continue;
    if (/^--\s*select\s*--$/i.test(opt.text)) continue;
    return opt;
  }

  return null;
}

function parseJsonLenient(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {}

  // Sometimes APIs return leading/trailing junk or HTML wrappers; keep this conservative.
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {}
  }

  const objStart = raw.indexOf("{");
  const objEnd = raw.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    try {
      return JSON.parse(raw.slice(objStart, objEnd + 1));
    } catch {}
  }

  return null;
}

function estimateRows(payload) {
  if (Array.isArray(payload)) return payload.length;

  if (!payload || typeof payload !== "object") return 0;

  if (Array.isArray(payload.data)) return payload.data.length;
  if (Array.isArray(payload.rows)) return payload.rows.length;
  if (Array.isArray(payload.result)) return payload.result.length;
  if (Array.isArray(payload.results)) return payload.results.length;

  return 1;
}

function findFirstInstituteId(payload) {
  const scan = (obj) => {
    if (!obj) return null;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = scan(item);
        if (found) return found;
      }
      return null;
    }

    if (typeof obj !== "object") return null;

    const keys = Object.keys(obj);
    for (const key of keys) {
      const lower = key.toLowerCase();
      if (
        lower === "aicteid" ||
        lower === "aicte_id" ||
        lower === "instid" ||
        lower === "instituteid" ||
        lower === "institute_id"
      ) {
        return clean(obj[key]);
      }
    }

    for (const key of keys) {
      const found = scan(obj[key]);
      if (found) return found;
    }

    return null;
  };

  return scan(payload);
}

async function hitUrl(url, label, outDir) {
  const res = await fetchUrl(url, {
    headers: {
      referer: "https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php#!/approved",
      accept: "application/json, text/plain, */*",
      "x-requested-with": "XMLHttpRequest",
    },
  });

  const text = res.text();
  const contentType = res.headers["content-type"] || "";
  const parsed = parseJsonLenient(text);
  const rowEstimate = estimateRows(parsed);

  const base = safeName(label);
  const txtPath = path.join(outDir, `${base}.txt`);
  const jsonPath = path.join(outDir, `${base}.json`);

  writeText(txtPath, text);
  writeJson(jsonPath, {
    url,
    statusCode: res.statusCode,
    contentType,
    rowEstimate,
    parsed,
  });

  return {
    label,
    url,
    statusCode: res.statusCode,
    contentType,
    rowEstimate,
    txtPath,
    jsonPath,
    parsed,
  };
}

async function main() {
  ensureDir(PARSED_DIR);

  const manifestPath = getLatestAicteProbeManifestPath();
  const manifest = readJson(manifestPath);
  const rawDir = manifest.rawDir;
  const runId = path.basename(rawDir);

  const selectsPath = findParsedFile("aicte_approvedinstitutes_selects", runId);
  const summaryPath = findParsedFile("aicte_fragment_summary", runId);

  const selects = readJson(selectsPath);
  const summary = readJson(summaryPath);

  console.log("Using manifest:", manifestPath);
  console.log("Using raw dir  :", rawDir);
  console.log("Using selects  :", selectsPath);

  const outDir = path.join(PARSED_DIR, `aicte_api_probe_${runId}`);
  ensureDir(outDir);

  const yearSelect =
    selects.find((s) => clean(s.id).toLowerCase() === "year") ||
    selects[0];
  const stateSelect =
    selects.find((s) => clean(s.id).toLowerCase() === "state") ||
    selects[1];
  const programSelect =
    selects.find((s) => clean(s.id).toLowerCase() === "program") ||
    selects[2];
  const courseSelect =
    selects.find((s) => clean(s.id).toLowerCase().includes("course")) ||
    selects.find((s) => clean(s.name).toLowerCase().includes("course")) ||
    null;

  const yearOpt = chooseOption(yearSelect);
  const stateOpt = chooseOption(stateSelect);
  const programOpt = chooseOption(programSelect, { preferAll: true });
  const courseOpt = chooseOption(courseSelect, { preferAll: true });

  const probes = [];

  if (!yearOpt) throw new Error("Could not determine year option.");
  if (!stateOpt) throw new Error("Could not determine state option.");
  if (!programOpt) throw new Error("Could not determine program option.");

  const instituteUrls = [
    {
      label: "approvedinstitutes_year_only",
      url: `${APPROVED_INSTITUTES_ENDPOINT}&year=${encodeURIComponent(yearOpt.value)}`,
    },
    {
      label: "approvedinstitutes_year_state",
      url: `${APPROVED_INSTITUTES_ENDPOINT}&year=${encodeURIComponent(yearOpt.value)}&state=${encodeURIComponent(stateOpt.value)}`,
    },
    {
      label: "approvedinstitutes_year_state_program",
      url: `${APPROVED_INSTITUTES_ENDPOINT}&year=${encodeURIComponent(yearOpt.value)}&state=${encodeURIComponent(stateOpt.value)}&program=${encodeURIComponent(programOpt.value)}`,
    },
    {
      label: "approvedinstitutes_year_program",
      url: `${APPROVED_INSTITUTES_ENDPOINT}&year=${encodeURIComponent(yearOpt.value)}&program=${encodeURIComponent(programOpt.value)}`,
    },
  ];

  for (const item of instituteUrls) {
    try {
      const result = await hitUrl(item.url, item.label, outDir);
      probes.push(result);
      console.log(
        `Hit ${item.label} -> status=${result.statusCode} rows≈${result.rowEstimate}`
      );
    } catch (err) {
      probes.push({
        label: item.label,
        url: item.url,
        error: String(err),
      });
      console.log(`Hit ${item.label} -> FAILED`);
    }
  }

  const successfulInstituteProbe = probes
    .filter((p) => !p.error && p.statusCode >= 200 && p.statusCode < 300)
    .sort((a, b) => (b.rowEstimate || 0) - (a.rowEstimate || 0))[0] || null;

  let courseProbe = null;
  let facultyProbe = null;

  if (successfulInstituteProbe && successfulInstituteProbe.parsed) {
    const aicteId = findFirstInstituteId(successfulInstituteProbe.parsed);

    if (aicteId) {
      try {
        const chosenCourseValue = courseOpt ? courseOpt.value : "1";

        courseProbe = await hitUrl(
          `${APPROVED_COURSE_ENDPOINT}&aicteid=${encodeURIComponent(aicteId)}&course=${encodeURIComponent(chosenCourseValue)}&year=${encodeURIComponent(yearOpt.value)}`,
          "approvedcourse_sample",
          outDir
        );

        console.log(
          `Hit approvedcourse_sample -> status=${courseProbe.statusCode} rows≈${courseProbe.rowEstimate}`
        );
      } catch (err) {
        courseProbe = {
          label: "approvedcourse_sample",
          error: String(err),
        };
        console.log("Hit approvedcourse_sample -> FAILED");
      }

      try {
        facultyProbe = await hitUrl(
          `${FACULTY_ENDPOINT}&aicteid=${encodeURIComponent(aicteId)}`,
          "faculty_sample",
          outDir
        );

        console.log(
          `Hit faculty_sample -> status=${facultyProbe.statusCode} rows≈${facultyProbe.rowEstimate}`
        );
      } catch (err) {
        facultyProbe = {
          label: "faculty_sample",
          error: String(err),
        };
        console.log("Hit faculty_sample -> FAILED");
      }
    }
  }

  const finalSummary = {
    manifestPath,
    rawDir,
    runId,
    chosenFilters: {
      year: yearOpt,
      state: stateOpt,
      program: programOpt,
      course: courseOpt,
    },
    fragmentSignals: {
      routeCount: summary.routeCount,
      ajaxCallCount: summary.ajaxCallCount,
      dataTableConfigCount: summary.dataTableConfigCount,
    },
    instituteProbes: probes,
    bestInstituteProbe: successfulInstituteProbe
      ? {
          label: successfulInstituteProbe.label,
          url: successfulInstituteProbe.url,
          statusCode: successfulInstituteProbe.statusCode,
          contentType: successfulInstituteProbe.contentType,
          rowEstimate: successfulInstituteProbe.rowEstimate,
          jsonPath: successfulInstituteProbe.jsonPath,
          txtPath: successfulInstituteProbe.txtPath,
        }
      : null,
    courseProbe,
    facultyProbe,
    nextAction: successfulInstituteProbe && successfulInstituteProbe.rowEstimate > 0
      ? "approvedinstituteserver.php is directly usable; next step should be building the real institute extractor"
      : "direct endpoint still unclear; next step should be a deeper state/program interaction probe",
  };

  const summaryOut = path.join(PARSED_DIR, `aicte_api_probe_summary_${runId}.json`);
  const reportOut = path.join(PARSED_DIR, `aicte_api_probe_report_${runId}.txt`);

  writeJson(summaryOut, finalSummary);

  const lines = [];
  lines.push(`Manifest: ${manifestPath}`);
  lines.push(`Raw Dir : ${rawDir}`);
  lines.push(`Run ID  : ${runId}`);
  lines.push("");
  lines.push("Chosen filters:");
  lines.push(`- year    = ${yearOpt.value} | ${yearOpt.text}`);
  lines.push(`- state   = ${stateOpt.value} | ${stateOpt.text}`);
  lines.push(`- program = ${programOpt.value} | ${programOpt.text}`);
  lines.push(`- course  = ${courseOpt ? `${courseOpt.value} | ${courseOpt.text}` : "(not found)"}`);
  lines.push("");

  lines.push("Institute probes:");
  for (const p of probes) {
    lines.push(`- ${p.label}`);
    lines.push(`  url=${p.url}`);
    if (p.error) {
      lines.push(`  error=${p.error}`);
    } else {
      lines.push(`  status=${p.statusCode} | contentType=${p.contentType} | rows≈${p.rowEstimate}`);
      lines.push(`  json=${p.jsonPath}`);
      lines.push(`  txt=${p.txtPath}`);
    }
  }
  lines.push("");

  if (courseProbe) {
    lines.push("Course probe:");
    if (courseProbe.error) {
      lines.push(`- error=${courseProbe.error}`);
    } else {
      lines.push(`- status=${courseProbe.statusCode} | rows≈${courseProbe.rowEstimate}`);
      lines.push(`  url=${courseProbe.url}`);
    }
    lines.push("");
  }

  if (facultyProbe) {
    lines.push("Faculty probe:");
    if (facultyProbe.error) {
      lines.push(`- error=${facultyProbe.error}`);
    } else {
      lines.push(`- status=${facultyProbe.statusCode} | rows≈${facultyProbe.rowEstimate}`);
      lines.push(`  url=${facultyProbe.url}`);
    }
    lines.push("");
  }

  lines.push(`Decision: ${finalSummary.nextAction}`);

  writeText(reportOut, lines.join("\n"));

  console.log("\nAICTE API PROBE COMPLETE");
  console.log("Output dir           :", outDir);
  console.log("Summary JSON         :", summaryOut);
  console.log("Report TXT           :", reportOut);
}

main().catch((err) => {
  console.error("AICTE API PROBE FAILED");
  console.error(err);
  process.exit(1);
});