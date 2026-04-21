	const path = require("path");
const { chromium } = require("playwright");

const {
  makeRunDirs,
  writeText,
  writeJson,
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

const SOURCE_ID = "aicte_all_states_direct";
const START_URL =
  "https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php#!/approved";
const API_BASE =
  "https://facilities.aicte-india.org/dashboard/pages/php/approvedinstituteserver.php?method=fetchdata";

const TARGET_YEAR = process.env.YEAR_VALUE || "2025-2026";
const TARGET_PROGRAM = process.env.PROGRAM_TEXT || "--All--";
const TARGET_LEVEL = process.env.LEVEL_TEXT || "--All--";
const TARGET_INSTITUTION_TYPE = process.env.INSTITUTION_TYPE_TEXT || "--All--";
const TARGET_WOMEN = process.env.WOMEN_TEXT || "--All--";
const TARGET_MINORITY = process.env.MINORITY_TEXT || "--All--";
const TARGET_COURSE = process.env.COURSE_TEXT || "";
const START_STATE_INDEX = Number(process.env.START_STATE_INDEX || 0);
const MAX_STATES =
  process.env.MAX_STATES && String(process.env.MAX_STATES).trim() !== ""
    ? Number(process.env.MAX_STATES)
    : null;
const HEADLESS = process.env.HEADLESS !== "false";

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

function dedupeRows(rows) {
  const seen = new Set();

  return rows.filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validOptions(selectInfo) {
  return (selectInfo?.options || []).filter((o) => {
    const value = String(o.value ?? "");
    const text = clean(o.text);

    if (!value && !text) return false;
    if (/^--\s*select\s*--$/i.test(text)) return false;
    if (/^select$/i.test(text)) return false;

    return true;
  });
}

function chooseOption(selectInfo, desiredText = "", desiredValue = "") {
  const opts = validOptions(selectInfo);

  if (desiredValue) {
    const byValue = opts.find((o) => norm(o.value) === norm(desiredValue));
    if (byValue) return byValue;
  }

  if (desiredText) {
    const byText = opts.find((o) => norm(o.text) === norm(desiredText));
    if (byText) return byText;
  }

  const broadLabels = ["--All--", "All", "--all--", ""];
  for (const label of broadLabels) {
    const found = opts.find((o) => norm(o.text) === norm(label));
    if (found) return found;
  }

  return opts[0] || null;
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

function normalizeInstituteRows(payload, meta) {
  const rows = extractArrayPayload(payload);

  return rows.map((row, idx) => {
    if (Array.isArray(row)) {
      return {
        admission_year: meta.year.text,
        year_value: meta.year.value,
        state: meta.state.text,
        state_value: meta.state.value,
        program_filter: meta.program.text,
        program_filter_value: meta.program.value,
        level_filter: meta.level.text,
        level_filter_value: meta.level.value,
        institutiontype_filter: meta.institutionType.text,
        institutiontype_filter_value: meta.institutionType.value,
        women_filter: meta.women.text,
        women_filter_value: meta.women.value,
        minority_filter: meta.minority.text,
        minority_filter_value: meta.minority.value,
        course_filter: meta.course,
        row_index: idx,
        aicte_id: clean(row[0]),
        name: clean(row[1]),
        address: clean(row[2]),
        district: clean(row[3]),
        institution_type: clean(row[4]),
        women: clean(row[5]),
        minority: clean(row[6]),
        course_details: clean(row[7]),
        faculty_details: clean(row[8]),
        raw: JSON.stringify(row),
      };
    }

    if (row && typeof row === "object") {
      const out = {
        admission_year: meta.year.text,
        year_value: meta.year.value,
        state: meta.state.text,
        state_value: meta.state.value,
        program_filter: meta.program.text,
        program_filter_value: meta.program.value,
        level_filter: meta.level.text,
        level_filter_value: meta.level.value,
        institutiontype_filter: meta.institutionType.text,
        institutiontype_filter_value: meta.institutionType.value,
        women_filter: meta.women.text,
        women_filter_value: meta.women.value,
        minority_filter: meta.minority.text,
        minority_filter_value: meta.minority.value,
        course_filter: meta.course,
        row_index: idx,
      };

      for (const [k, v] of Object.entries(row)) {
        out[k] = clean(v);
      }

      return out;
    }

    return {
      admission_year: meta.year.text,
      year_value: meta.year.value,
      state: meta.state.text,
      state_value: meta.state.value,
      program_filter: meta.program.text,
      program_filter_value: meta.program.value,
      level_filter: meta.level.text,
      level_filter_value: meta.level.value,
      institutiontype_filter: meta.institutionType.text,
      institutiontype_filter_value: meta.institutionType.value,
      women_filter: meta.women.text,
      women_filter_value: meta.women.value,
      minority_filter: meta.minority.text,
      minority_filter_value: meta.minority.value,
      course_filter: meta.course,
      row_index: idx,
      raw: clean(row),
    };
  });
}

async function snapshotFilters(page) {
  return await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();

    const selects = Array.from(document.querySelectorAll("select")).map((select, idx) => ({
      index: idx,
      id: select.id || "",
      name: select.name || "",
      optionCount: select.options.length,
      selectedValue: clean(select.value),
      selectedText: clean(
        select.options[select.selectedIndex]
          ? select.options[select.selectedIndex].textContent
          : ""
      ),
      options: Array.from(select.options).map((opt) => ({
        value: String(opt.value ?? ""),
        text: clean(opt.textContent),
      })),
    }));

    const courseValue = document.getElementById("course")?.value ?? "";

    return {
      selects,
      courseValue: String(courseValue),
    };
  });
}

function summarizeStateLog(stateLog, combinedRows) {
  return {
    totalStatesTried: stateLog.length,
    successfulStates: stateLog.filter((x) => x.status === "success").length,
    failedStates: stateLog.filter((x) => x.status === "failed").length,
    zeroRowStates: stateLog.filter((x) => x.status === "success" && (x.rowCount || 0) === 0).length,
    totalRows: combinedRows.length,
  };
}

function flushProgress(rawDir, combinedRows, stateLog, filterSummary) {
  const deduped = dedupeRows(combinedRows);

  const combinedJsonPath = path.join(rawDir, "combined_rows_progress.json");
  const combinedCsvPath = path.join(rawDir, "combined_rows_progress.csv");
  const stateLogPath = path.join(rawDir, "state_log.json");
  const summaryPath = path.join(rawDir, "final_summary.json");

  writeJson(combinedJsonPath, deduped);
  writeText(combinedCsvPath, rowsToCsv(deduped));
  writeJson(stateLogPath, stateLog);
  writeJson(summaryPath, {
    ...summarizeStateLog(stateLog, deduped),
    filters: filterSummary,
  });

  return {
    combinedJsonPath,
    combinedCsvPath,
    stateLogPath,
    summaryPath,
    dedupedRows: deduped,
  };
}

async function fetchStatePayload(page, url) {
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
  const stateLog = [];

  try {
    addNote(manifest, "Starting all-states direct AICTE extractor.");
    addVisitedUrl(manifest, START_URL);

    await page.goto(START_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    await page.waitForFunction(
      () => document.querySelectorAll("select").length >= 7,
      { timeout: 30000 }
    ).catch(() => null);

    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    const snapshot = await snapshotFilters(page);

    const yearSelect = snapshot.selects.find((s) => norm(s.id) === "year");
    const stateSelect = snapshot.selects.find((s) => norm(s.id) === "state");
    const programSelect = snapshot.selects.find((s) => norm(s.id) === "program");
    const levelSelect = snapshot.selects.find((s) => norm(s.id) === "level");
    const institutionTypeSelect = snapshot.selects.find((s) => norm(s.id) === "institutiontype");
    const womenSelect = snapshot.selects.find((s) => norm(s.id) === "women");
    const minoritySelect = snapshot.selects.find((s) => norm(s.id) === "minority");

    if (!yearSelect || !stateSelect || !programSelect) {
      throw new Error("Required selects not found on page.");
    }

    const yearChoice = chooseOption(yearSelect, TARGET_YEAR, TARGET_YEAR);
    const programChoice = chooseOption(programSelect, TARGET_PROGRAM, TARGET_PROGRAM);
    const levelChoice = levelSelect
      ? chooseOption(levelSelect, TARGET_LEVEL, TARGET_LEVEL)
      : { text: "", value: "" };
    const institutionTypeChoice = institutionTypeSelect
      ? chooseOption(institutionTypeSelect, TARGET_INSTITUTION_TYPE, TARGET_INSTITUTION_TYPE)
      : { text: "", value: "" };
    const womenChoice = womenSelect
      ? chooseOption(womenSelect, TARGET_WOMEN, TARGET_WOMEN)
      : { text: "", value: "" };
    const minorityChoice = minoritySelect
      ? chooseOption(minoritySelect, TARGET_MINORITY, TARGET_MINORITY)
      : { text: "", value: "" };

    if (!yearChoice) throw new Error("No usable year option found.");
    if (!programChoice) throw new Error("No usable program option found.");
    if (!levelChoice) throw new Error("No usable level option found.");
    if (!institutionTypeChoice) throw new Error("No usable institution type option found.");
    if (!womenChoice) throw new Error("No usable Women option found.");
    if (!minorityChoice) throw new Error("No usable Minority option found.");

    const courseValue =
      clean(TARGET_COURSE) ||
      clean(snapshot.courseValue) ||
      "1";

    const allStates = validOptions(stateSelect);
    const targetStates = allStates.slice(
      START_STATE_INDEX,
      MAX_STATES ? START_STATE_INDEX + MAX_STATES : undefined
    );

    const filterSummary = {
      year: yearChoice,
      program: programChoice,
      level: levelChoice,
      institutionType: institutionTypeChoice,
      women: womenChoice,
      minority: minorityChoice,
      course: courseValue,
      startStateIndex: START_STATE_INDEX,
      maxStates: MAX_STATES,
      headless: HEADLESS,
    };

    writeJson(path.join(dirs.rawDir, "resolved_filters.json"), filterSummary);
    writeJson(path.join(dirs.rawDir, "all_states_options.json"), allStates);
    writeJson(path.join(dirs.rawDir, "target_states.json"), targetStates);

    console.log("Resolved year         :", yearChoice.text, "|", JSON.stringify(yearChoice.value));
    console.log("Resolved program      :", programChoice.text, "|", JSON.stringify(programChoice.value));
    console.log("Resolved level        :", levelChoice.text, "|", JSON.stringify(levelChoice.value));
    console.log("Resolved inst. type   :", institutionTypeChoice.text, "|", JSON.stringify(institutionTypeChoice.value));
    console.log("Resolved Women        :", womenChoice.text, "|", JSON.stringify(womenChoice.value));
    console.log("Resolved Minority     :", minorityChoice.text, "|", JSON.stringify(minorityChoice.value));
    console.log("Resolved course       :", JSON.stringify(courseValue));
    console.log("States to process     :", targetStates.length);

    for (let i = 0; i < targetStates.length; i++) {
      const stateChoice = targetStates[i];
      const stateLabel = `${String(i + START_STATE_INDEX + 1).padStart(2, "0")}_${safeName(stateChoice.text)}`;
      const stateDir = path.join(dirs.rawDir, stateLabel);
      ensureDir(stateDir);

      const url =
        `${API_BASE}` +
        `&year=${encodeURIComponent(yearChoice.value)}` +
        `&program=${encodeURIComponent(programChoice.value)}` +
        `&level=${encodeURIComponent(levelChoice.value)}` +
        `&institutiontype=${encodeURIComponent(institutionTypeChoice.value)}` +
        `&Women=${encodeURIComponent(womenChoice.value)}` +
        `&Minority=${encodeURIComponent(minorityChoice.value)}` +
        `&state=${encodeURIComponent(stateChoice.value)}` +
        `&course=${encodeURIComponent(courseValue)}`;

      try {
        const response = await fetchStatePayload(page, url);
        const parsed = parseJsonLenient(response.text);
        const rows = normalizeInstituteRows(parsed, {
          year: yearChoice,
          state: stateChoice,
          program: programChoice,
          level: levelChoice,
          institutionType: institutionTypeChoice,
          women: womenChoice,
          minority: minorityChoice,
          course: courseValue,
        });

        const requestMetaPath = path.join(stateDir, "request_meta.json");
        const rawBodyPath = path.join(stateDir, "approvedinstituteserver_raw.txt");
        const parsedPath = path.join(stateDir, "approvedinstituteserver_parsed.json");
        const rowsJsonPath = path.join(stateDir, "rows.json");
        const rowsCsvPath = path.join(stateDir, "rows.csv");
        const summaryPath = path.join(stateDir, "summary.json");

        writeJson(requestMetaPath, {
          url,
          status: response.status,
          headers: response.headers,
          filters: {
            year: yearChoice,
            state: stateChoice,
            program: programChoice,
            level: levelChoice,
            institutionType: institutionTypeChoice,
            women: womenChoice,
            minority: minorityChoice,
            course: courseValue,
          },
        });
        writeText(rawBodyPath, response.text);
        writeJson(parsedPath, parsed);
        writeJson(rowsJsonPath, rows);
        writeText(rowsCsvPath, rowsToCsv(rows));
        writeJson(summaryPath, {
          state: stateChoice,
          status: response.status,
          contentType: response.headers["content-type"] || "",
          rowCount: rows.length,
          url,
        });

        combinedRows.push(...rows);
        stateLog.push({
          status: "success",
          state: stateChoice.text,
          state_value: stateChoice.value,
          rowCount: rows.length,
          statusCode: response.status,
          requestMetaPath,
          rowsJsonPath,
          rowsCsvPath,
        });

        console.log(
          `[${i + 1}/${targetStates.length}] ${stateChoice.text} | status=${response.status} | rows=${rows.length}`
        );
      } catch (err) {
        stateLog.push({
          status: "failed",
          state: stateChoice.text,
          state_value: stateChoice.value,
          error: String(err),
        });

        addError(manifest, err, {
          stage: "state_direct_fetch",
          state: stateChoice.text,
          stateValue: stateChoice.value,
          url,
        });

        console.log(
          `[${i + 1}/${targetStates.length}] ${stateChoice.text} | FAILED | ${String(err)}`
        );
      }

      flushProgress(dirs.rawDir, combinedRows, stateLog, filterSummary);
      await page.waitForTimeout(400);
    }

    const paths = flushProgress(dirs.rawDir, combinedRows, stateLog, filterSummary);

    addFile(manifest, {
      type: "json",
      filePath: path.join(dirs.rawDir, "resolved_filters.json"),
      url: START_URL,
      note: "Resolved shared filters",
    });
    addFile(manifest, {
      type: "json",
      filePath: path.join(dirs.rawDir, "all_states_options.json"),
      url: START_URL,
      note: "All state options from live DOM",
    });
    addFile(manifest, {
      type: "json",
      filePath: path.join(dirs.rawDir, "target_states.json"),
      url: START_URL,
      note: "Target states for this run",
    });
    addFile(manifest, {
      type: "json",
      filePath: paths.combinedJsonPath,
      url: START_URL,
      note: "Combined all-states rows JSON",
    });
    addFile(manifest, {
      type: "csv",
      filePath: paths.combinedCsvPath,
      url: START_URL,
      note: "Combined all-states rows CSV",
    });
    addFile(manifest, {
      type: "json",
      filePath: paths.stateLogPath,
      url: START_URL,
      note: "State log",
    });
    addFile(manifest, {
      type: "json",
      filePath: paths.summaryPath,
      url: START_URL,
      note: "Final summary",
    });

    const summary = summarizeStateLog(stateLog, paths.dedupedRows);
    addNote(
      manifest,
      `All-states direct AICTE extraction completed. States=${summary.totalStatesTried}, Rows=${summary.totalRows}`
    );

    console.log("\nAICTE ALL-STATES DIRECT EXTRACTION COMPLETE");
    console.log("States tried         :", summary.totalStatesTried);
    console.log("Successful states    :", summary.successfulStates);
    console.log("Failed states        :", summary.failedStates);
    console.log("Zero-row states      :", summary.zeroRowStates);
    console.log("Combined rows        :", summary.totalRows);
    console.log("Combined JSON        :", paths.combinedJsonPath);
    console.log("Combined CSV         :", paths.combinedCsvPath);
    console.log("State log            :", paths.stateLogPath);
    console.log("Final summary        :", paths.summaryPath);
  } catch (err) {
    addError(manifest, err, { stage: "main" });
    console.log("Extraction failed:", String(err));
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close().catch(() => {});
    await browser.close().catch(() => {});

    console.log("\nAICTE ALL-STATES DIRECT SCRIPT COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("AICTE ALL-STATES DIRECT EXTRACTION FAILED");
  console.error(err);
  process.exit(1);
});