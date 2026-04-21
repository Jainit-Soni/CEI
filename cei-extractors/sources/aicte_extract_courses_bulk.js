const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const {
  makeRunDirs,
  writeText,
  writeJson,
  listFiles,
  readJson,
  safeName,
  ensureDir,
} = require("../core/io");

const {
  createManifest,
  addVisitedUrl,
  addFile,
  addNote,
  addError,
  saveManifest,
} = require("../core/manifest");

const SOURCE_ID = "aicte_courses_bulk";
const START_URL =
  "https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php#!/approved";
const API_BASE =
  "https://facilities.aicte-india.org/dashboard/pages/php/approvedcourse.php?method=fetchdata";

const HEADLESS = process.env.HEADLESS !== "false";
const START_INDEX = Number(process.env.START_INDEX || 0);
const MAX_INSTITUTES =
  process.env.MAX_INSTITUTES && String(process.env.MAX_INSTITUTES).trim() !== ""
    ? Number(process.env.MAX_INSTITUTES)
    : null;
const THROTTLE_MS = Number(process.env.THROTTLE_MS || 250);

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function norm(text) {
  return clean(text).toLowerCase();
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

function dedupeRows(rows, keyFn) {
  const seen = new Set();

  return rows.filter((row) => {
    const key = keyFn(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getLatestAicteAllStatesManifestPath() {
  const files = listFiles(path.join(process.cwd(), "cei-extractors", "output", "manifests"))
    .filter((name) => name.startsWith("aicte_all_states_direct_") && name.endsWith(".json"))
    .sort();

  if (!files.length) {
    throw new Error("No aicte_all_states_direct manifest found.");
  }

  return path.join(process.cwd(), "cei-extractors", "output", "manifests", files[files.length - 1]);
}

function parseJsonLenient(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {}

  const arrStart = raw.indexOf("[");
  const arrEnd = raw.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
    try {
      return JSON.parse(raw.slice(arrStart, arrEnd + 1));
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

function extractArrayPayload(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.data)) return parsed.data;
  if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
  if (parsed && Array.isArray(parsed.result)) return parsed.result;
  if (parsed && Array.isArray(parsed.results)) return parsed.results;
  return [];
}

function deriveYearRange(row) {
  const candidates = [
    row.year_value,
    row.admission_year,
    row.extracted_at,
  ].map(clean).filter(Boolean);

  for (const c of candidates) {
    if (/^\d{4}-\d{4}$/.test(c)) return c;
  }

  for (const c of candidates) {
    if (/^\d{4}$/.test(c)) {
      const y = Number(c);
      return `${y}-${y + 1}`;
    }
  }

  return "2025-2026";
}

function deriveCourseArg(row) {
  const candidates = [
    row.course_details,
    row.course_details_ref,
    row.raw,
  ].map((x) => String(x || ""));

  for (const text of candidates) {
    const m1 = text.match(/openRightMenu1\s*\(\s*['"]?([^,'")]+)['"]?\s*,\s*['"]?([^,'")]+)['"]?\s*,\s*['"]?([^,'")]+)['"]?\s*\)/i);
    if (m1 && clean(m1[2])) return clean(m1[2]);

    const m2 = text.match(/approvedcourse\.php\?method=fetchdata[^"' ]*?[?&]course=([^&"' ]+)/i);
    if (m2 && clean(m2[1])) return clean(m2[1]);
  }

  if (clean(row.course_filter)) return clean(row.course_filter);
  if (clean(row.course_filter_value)) return clean(row.course_filter_value);

  return "1";
}

function buildInstituteJob(row) {
  return {
    aicte_id: clean(row.aicte_id),
    institute_name: clean(row.name || row.institute_name),
    state: clean(row.state),
    state_value: clean(row.state_value),
    year_range: deriveYearRange(row),
    course_arg: deriveCourseArg(row),
    source_row: row,
  };
}

function normalizeCourseRows(payload, job) {
  const rows = extractArrayPayload(payload);

  return rows.map((row, idx) => {
    if (Array.isArray(row)) {
      return {
        source: "aicte_approved_courses",
        extractor_scope: "bulk_direct",
        aicte_id: clean(row[0]),
        institute_name: clean(row[1]),
        institute_internal_id: clean(row[2]),
        programme: clean(row[3]),
        university: clean(row[4]),
        course_level: clean(row[5]),
        course_name: clean(row[6]),
        course_type: clean(row[7]),
        unknown_8: clean(row[8]),
        unknown_9: clean(row[9]),
        intake: clean(row[10]),
        enrollment: clean(row[11]),
        placement: clean(row[12]),
        state: job.state,
        state_value: job.state_value,
        requested_year: job.year_range,
        requested_course_arg: job.course_arg,
        parent_institute_name: job.institute_name,
        row_index: idx,
        raw: JSON.stringify(row),
      };
    }

    if (row && typeof row === "object") {
      const out = {
        source: "aicte_approved_courses",
        extractor_scope: "bulk_direct",
        aicte_id: clean(job.aicte_id),
        institute_name: clean(job.institute_name),
        state: job.state,
        state_value: job.state_value,
        requested_year: job.year_range,
        requested_course_arg: job.course_arg,
        row_index: idx,
      };

      for (const [k, v] of Object.entries(row)) {
        out[k] = clean(v);
      }

      return out;
    }

    return {
      source: "aicte_approved_courses",
      extractor_scope: "bulk_direct",
      aicte_id: clean(job.aicte_id),
      institute_name: clean(job.institute_name),
      state: job.state,
      state_value: job.state_value,
      requested_year: job.year_range,
      requested_course_arg: job.course_arg,
      row_index: idx,
      raw: clean(row),
    };
  });
}

function summarize(jobLog, combinedRows) {
  const byState = {};
  const byInstitute = {};

  for (const row of combinedRows) {
    byState[row.state || "(blank)"] = (byState[row.state || "(blank)"] || 0) + 1;
    byInstitute[row.parent_institute_name || row.institute_name || "(blank)"] =
      (byInstitute[row.parent_institute_name || row.institute_name || "(blank)"] || 0) + 1;
  }

  const topN = (obj, n = 25) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));

  return {
    jobsTried: jobLog.length,
    successfulJobs: jobLog.filter((x) => x.status === "success").length,
    failedJobs: jobLog.filter((x) => x.status === "failed").length,
    zeroRowJobs: jobLog.filter((x) => x.status === "success" && (x.rowCount || 0) === 0).length,
    totalCourseRows: combinedRows.length,
    stateDistribution: topN(byState, 100),
    topInstitutesByCourseRows: topN(byInstitute, 100),
  };
}

function flushProgress(rawDir, combinedRows, jobLog) {
  const dedupedRows = dedupeRows(
    combinedRows,
    (row) =>
      [
        row.aicte_id,
        row.institute_name,
        row.programme,
        row.university,
        row.course_level,
        row.course_name,
        row.course_type,
        row.intake,
        row.enrollment,
        row.placement,
        row.requested_year,
      ].join("||")
  );

  const combinedJsonPath = path.join(rawDir, "combined_course_rows_progress.json");
  const combinedCsvPath = path.join(rawDir, "combined_course_rows_progress.csv");
  const jobLogPath = path.join(rawDir, "job_log.json");
  const summaryPath = path.join(rawDir, "final_summary.json");

  writeJson(combinedJsonPath, dedupedRows);
  writeText(combinedCsvPath, rowsToCsv(dedupedRows));
  writeJson(jobLogPath, jobLog);
  writeJson(summaryPath, summarize(jobLog, dedupedRows));

  return {
    combinedJsonPath,
    combinedCsvPath,
    jobLogPath,
    summaryPath,
    dedupedRows,
  };
}

async function fetchCoursePayload(page, url) {
  return await page.evaluate(async (targetUrl) => {
    const r = await fetch(targetUrl, {
      credentials: "include",
      headers: {
        "x-requested-with": "XMLHttpRequest",
        "accept": "application/json, text/plain, */*",
      },
    });

    const text = await r.text();
    const headers = {};
    r.headers.forEach((v, k) => {
      headers[k] = v;
    });

    return {
      status: r.status,
      headers,
      text,
    };
  }, url);
}

async function main() {
  const dirs = makeRunDirs(SOURCE_ID);
  ensureDir(dirs.rawDir);

  const manifest = createManifest(SOURCE_ID, dirs.runId, START_URL, dirs.rawDir);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
  });

  const page = await context.newPage();

  const combinedRows = [];
  const jobLog = [];

  try {
    addNote(manifest, "Starting bulk AICTE course extraction.");
    addVisitedUrl(manifest, START_URL);

    await page.goto(START_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);

    const instituteManifestPath = getLatestAicteAllStatesManifestPath();
    const instituteManifest = readJson(instituteManifestPath);
    const instituteRawDir = instituteManifest.rawDir;

    if (!instituteRawDir || !fs.existsSync(instituteRawDir)) {
      throw new Error(`Institute raw dir not found: ${instituteRawDir}`);
    }

    const instituteInputPath = path.join(instituteRawDir, "combined_rows_progress.json");
    if (!fs.existsSync(instituteInputPath)) {
      throw new Error(`Institute input file not found: ${instituteInputPath}`);
    }

    const instituteRows = readJson(instituteInputPath);

    const jobs = dedupeRows(
      instituteRows
        .map(buildInstituteJob)
        .filter((j) => clean(j.aicte_id)),
      (j) => [j.aicte_id, j.year_range, j.course_arg].join("||")
    );

    const targetJobs = jobs.slice(
      START_INDEX,
      MAX_INSTITUTES ? START_INDEX + MAX_INSTITUTES : undefined
    );

    writeJson(path.join(dirs.rawDir, "jobs_all.json"), jobs);
    writeJson(path.join(dirs.rawDir, "jobs_target.json"), targetJobs);

    console.log("Institute source manifest:", instituteManifestPath);
    console.log("Institute input         :", instituteInputPath);
    console.log("Total unique jobs       :", jobs.length);
    console.log("Jobs to process         :", targetJobs.length);

    for (let i = 0; i < targetJobs.length; i++) {
      const job = targetJobs[i];
      const label = `${String(i + START_INDEX + 1).padStart(5, "0")}_${safeName(job.aicte_id)}_${safeName(job.institute_name).slice(0, 80)}`;
      const jobDir = path.join(dirs.rawDir, label);
      ensureDir(jobDir);

      const url =
        `${API_BASE}` +
        `&aicteid=${encodeURIComponent(job.aicte_id)}` +
        `&course=${encodeURIComponent(job.course_arg)}` +
        `&year=${encodeURIComponent(job.year_range)}`;

      try {
        const response = await fetchCoursePayload(page, url);
        const parsed = parseJsonLenient(response.text);
        const rows = normalizeCourseRows(parsed, job);

        const requestMetaPath = path.join(jobDir, "request_meta.json");
        const rawBodyPath = path.join(jobDir, "approvedcourse_raw.txt");
        const parsedPath = path.join(jobDir, "approvedcourse_parsed.json");
        const rowsJsonPath = path.join(jobDir, "rows.json");
        const rowsCsvPath = path.join(jobDir, "rows.csv");
        const summaryPath = path.join(jobDir, "summary.json");

        writeJson(requestMetaPath, {
          url,
          status: response.status,
          headers: response.headers,
          job,
        });
        writeText(rawBodyPath, response.text);
        writeJson(parsedPath, parsed);
        writeJson(rowsJsonPath, rows);
        writeText(rowsCsvPath, rowsToCsv(rows));
        writeJson(summaryPath, {
          aicte_id: job.aicte_id,
          institute_name: job.institute_name,
          state: job.state,
          requested_year: job.year_range,
          requested_course_arg: job.course_arg,
          status: response.status,
          contentType: response.headers["content-type"] || "",
          rowCount: rows.length,
          url,
        });

        combinedRows.push(...rows);
        jobLog.push({
          status: "success",
          aicte_id: job.aicte_id,
          institute_name: job.institute_name,
          state: job.state,
          requested_year: job.year_range,
          requested_course_arg: job.course_arg,
          statusCode: response.status,
          rowCount: rows.length,
          requestMetaPath,
          rowsJsonPath,
          rowsCsvPath,
        });

        console.log(
          `[${i + 1}/${targetJobs.length}] ${job.aicte_id} | ${job.institute_name} | rows=${rows.length} | status=${response.status}`
        );
      } catch (err) {
        jobLog.push({
          status: "failed",
          aicte_id: job.aicte_id,
          institute_name: job.institute_name,
          state: job.state,
          requested_year: job.year_range,
          requested_course_arg: job.course_arg,
          error: String(err),
        });

        addError(manifest, err, {
          stage: "course_direct_fetch",
          aicte_id: job.aicte_id,
          institute_name: job.institute_name,
          state: job.state,
          year: job.year_range,
          courseArg: job.course_arg,
          url,
        });

        console.log(
          `[${i + 1}/${targetJobs.length}] ${job.aicte_id} | ${job.institute_name} | FAILED | ${String(err)}`
        );
      }

      flushProgress(dirs.rawDir, combinedRows, jobLog);
      await page.waitForTimeout(THROTTLE_MS);
    }

    const paths = flushProgress(dirs.rawDir, combinedRows, jobLog);

    addFile(manifest, {
      type: "json",
      filePath: path.join(dirs.rawDir, "jobs_all.json"),
      url: START_URL,
      note: "All unique institute course jobs",
    });
    addFile(manifest, {
      type: "json",
      filePath: path.join(dirs.rawDir, "jobs_target.json"),
      url: START_URL,
      note: "Target jobs for this run",
    });
    addFile(manifest, {
      type: "json",
      filePath: paths.combinedJsonPath,
      url: START_URL,
      note: "Combined course rows JSON",
    });
    addFile(manifest, {
      type: "csv",
      filePath: paths.combinedCsvPath,
      url: START_URL,
      note: "Combined course rows CSV",
    });
    addFile(manifest, {
      type: "json",
      filePath: paths.jobLogPath,
      url: START_URL,
      note: "Bulk course job log",
    });
    addFile(manifest, {
      type: "json",
      filePath: paths.summaryPath,
      url: START_URL,
      note: "Bulk course final summary",
    });

    const summary = summarize(jobLog, paths.dedupedRows);
    addNote(
      manifest,
      `Bulk AICTE course extraction completed. Jobs=${summary.jobsTried}, Rows=${summary.totalCourseRows}`
    );

    console.log("\nAICTE BULK COURSE EXTRACTION COMPLETE");
    console.log("Jobs tried           :", summary.jobsTried);
    console.log("Successful jobs      :", summary.successfulJobs);
    console.log("Failed jobs          :", summary.failedJobs);
    console.log("Zero-row jobs        :", summary.zeroRowJobs);
    console.log("Combined course rows :", summary.totalCourseRows);
    console.log("Combined JSON        :", paths.combinedJsonPath);
    console.log("Combined CSV         :", paths.combinedCsvPath);
    console.log("Job log              :", paths.jobLogPath);
    console.log("Final summary        :", paths.summaryPath);
  } catch (err) {
    addError(manifest, err, { stage: "main" });
    console.log("Extraction failed:", String(err));
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close().catch(() => {});
    await browser.close().catch(() => {});

    console.log("\nAICTE BULK COURSE SCRIPT COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("AICTE BULK COURSE EXTRACTION FAILED");
  console.error(err);
  process.exit(1);
});