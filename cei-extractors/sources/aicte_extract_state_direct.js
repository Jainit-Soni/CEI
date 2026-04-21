const path = require("path");
const { chromium } = require("playwright");

const {
  makeRunDirs,
  writeText,
  writeJson,
  safeName,
} = require("../core/io");

const {
  createManifest,
  addVisitedUrl,
  addFile,
  addNote,
  addError,
  saveManifest,
} = require("../core/manifest");

const SOURCE_ID = "aicte_state_direct";
const START_URL =
  "https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php#!/approved";
const API_BASE =
  "https://facilities.aicte-india.org/dashboard/pages/php/approvedinstituteserver.php?method=fetchdata";

const TARGET_YEAR = process.env.YEAR_VALUE || "2025-2026";
const TARGET_STATE = process.env.STATE_NAME || "Andhra Pradesh";
const TARGET_PROGRAM = process.env.PROGRAM_TEXT || "--All--";
const TARGET_LEVEL = process.env.LEVEL_TEXT || "--All--";
const TARGET_INSTITUTION_TYPE = process.env.INSTITUTION_TYPE_TEXT || "--All--";
const TARGET_WOMEN = process.env.WOMEN_TEXT || "--All--";
const TARGET_MINORITY = process.env.MINORITY_TEXT || "--All--";
const TARGET_COURSE = process.env.COURSE_TEXT || "";
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

    const courseValue =
      document.getElementById("course")?.value ??
      "";

    return {
      selects,
      courseValue: String(courseValue),
    };
  });
}

async function main() {
  const dirs = makeRunDirs(SOURCE_ID);
  const manifest = createManifest(SOURCE_ID, dirs.runId, START_URL, dirs.rawDir);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
  });

  const page = await context.newPage();

  try {
    addNote(manifest, "Starting direct AICTE state extractor using discovered endpoint.");
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
      throw new Error("Required selects not found on page");
    }

    const yearChoice = chooseOption(yearSelect, TARGET_YEAR, TARGET_YEAR);
    const stateChoice = chooseOption(stateSelect, TARGET_STATE, TARGET_STATE);
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

    if (!yearChoice) throw new Error("No usable year option found");
    if (!stateChoice) throw new Error("No usable state option found");
    if (!programChoice) throw new Error("No usable program option found");
    if (!levelChoice) throw new Error("No usable level option found");
    if (!institutionTypeChoice) throw new Error("No usable institution type option found");
    if (!womenChoice) throw new Error("No usable women option found");
    if (!minorityChoice) throw new Error("No usable minority option found");

    const courseValue =
      clean(TARGET_COURSE) ||
      clean(snapshot.courseValue) ||
      "1";

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

    console.log("Resolved year         :", yearChoice.text, "|", JSON.stringify(yearChoice.value));
    console.log("Resolved state        :", stateChoice.text, "|", JSON.stringify(stateChoice.value));
    console.log("Resolved program      :", programChoice.text, "|", JSON.stringify(programChoice.value));
    console.log("Resolved level        :", levelChoice.text, "|", JSON.stringify(levelChoice.value));
    console.log("Resolved inst. type   :", institutionTypeChoice.text, "|", JSON.stringify(institutionTypeChoice.value));
    console.log("Resolved Women        :", womenChoice.text, "|", JSON.stringify(womenChoice.value));
    console.log("Resolved Minority     :", minorityChoice.text, "|", JSON.stringify(minorityChoice.value));
    console.log("Resolved course       :", JSON.stringify(courseValue));
    console.log("Request URL           :", url);

    const response = await page.evaluate(async (targetUrl) => {
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

    const contentType = response.headers["content-type"] || "";
    const parsed = parseJsonLenient(response.text);
    const normalizedRows = normalizeInstituteRows(parsed, {
      year: yearChoice,
      state: stateChoice,
      program: programChoice,
      level: levelChoice,
      institutionType: institutionTypeChoice,
      women: womenChoice,
      minority: minorityChoice,
      course: courseValue,
    });

    const requestMetaPath = path.join(dirs.rawDir, "request_meta.json");
    const rawBodyPath = path.join(dirs.rawDir, "approvedinstituteserver_raw.txt");
    const parsedPath = path.join(dirs.rawDir, "approvedinstituteserver_parsed.json");
    const rowsJsonPath = path.join(dirs.rawDir, "rows.json");
    const rowsCsvPath = path.join(dirs.rawDir, "rows.csv");
    const summaryPath = path.join(dirs.rawDir, "summary.json");

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
    writeJson(rowsJsonPath, normalizedRows);
    writeText(rowsCsvPath, rowsToCsv(normalizedRows));
    writeJson(summaryPath, {
      runId: dirs.runId,
      status: response.status,
      contentType,
      rowCount: normalizedRows.length,
      url,
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

    addFile(manifest, {
      type: "json",
      filePath: requestMetaPath,
      url,
      note: "Direct request metadata",
    });
    addFile(manifest, {
      type: "text",
      filePath: rawBodyPath,
      url,
      note: "Direct raw response body",
    });
    addFile(manifest, {
      type: "json",
      filePath: parsedPath,
      url,
      note: "Parsed response payload",
    });
    addFile(manifest, {
      type: "json",
      filePath: rowsJsonPath,
      url,
      note: "Normalized institute rows JSON",
    });
    addFile(manifest, {
      type: "csv",
      filePath: rowsCsvPath,
      url,
      note: "Normalized institute rows CSV",
    });
    addFile(manifest, {
      type: "json",
      filePath: summaryPath,
      url,
      note: "Direct extraction summary",
    });

    addNote(
      manifest,
      `Direct AICTE extraction completed. State=${stateChoice.text}, rows=${normalizedRows.length}`
    );

    console.log("\nAICTE DIRECT STATE EXTRACTION COMPLETE");
    console.log("HTTP status          :", response.status);
    console.log("Content-Type         :", contentType);
    console.log("Rows collected       :", normalizedRows.length);
    console.log("Request meta JSON    :", requestMetaPath);
    console.log("Raw body TXT         :", rawBodyPath);
    console.log("Parsed payload JSON  :", parsedPath);
    console.log("Rows JSON            :", rowsJsonPath);
    console.log("Rows CSV             :", rowsCsvPath);
    console.log("Summary JSON         :", summaryPath);
  } catch (err) {
    addError(manifest, err, { stage: "main" });
    console.log("Extraction failed:", String(err));
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close().catch(() => {});
    await browser.close().catch(() => {});

    console.log("\nAICTE DIRECT STATE SCRIPT COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("AICTE DIRECT STATE EXTRACTION FAILED");
  console.error(err);
  process.exit(1);
});