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

const SOURCE_ID = "aicte_visible_local";
const START_URL =
  "https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php#!/approved";

const YEAR_PREFERENCE = process.env.YEAR_VALUE || "2025-2026";
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
    const value = clean(o.value);
    const text = clean(o.text);

    if (!value && !text) return false;
    if (/^--\s*select\s*--$/i.test(text)) return false;
    if (/^select$/i.test(text)) return false;
    return true;
  });
}

function findSelect(dom, id) {
  return (dom.selects || []).find((s) => norm(s.id) === norm(id)) || null;
}

function chooseYear(selectInfo) {
  const opts = validOptions(selectInfo);

  const preferred =
    opts.find((o) => norm(o.value) === norm(YEAR_PREFERENCE)) ||
    opts.find((o) => norm(o.text) === norm(YEAR_PREFERENCE));

  return preferred || opts[0] || null;
}

function chooseProgram(selectInfo) {
  const opts = validOptions(selectInfo);

  const preferred =
    opts.find((o) => /^--all--$/i.test(clean(o.text))) ||
    opts.find((o) => /^all$/i.test(clean(o.text))) ||
    opts.find((o) => clean(o.value) === "1");

  return preferred || opts[0] || null;
}

function scoreTable(table) {
  const rows = table?.rows || [];
  const headers = rows[0] || [];
  const joined = rows.flat().join(" ").toLowerCase();
  const headerBlob = headers.join(" ").toLowerCase();

  let score = 0;

  if (joined.includes("institute")) score += 20;
  if (joined.includes("state")) score += 10;
  if (joined.includes("program")) score += 8;
  if (joined.includes("course")) score += 8;
  if (joined.includes("approved")) score += 6;
  if (headerBlob.includes("institute")) score += 12;
  if (headerBlob.includes("state")) score += 8;
  if ((table.rowCount || 0) > 1) score += 6;
  if ((table.columnCount || 0) >= 3) score += 4;

  return score;
}

function pickBestTable(tables) {
  const scored = (tables || [])
    .map((t) => ({ ...t, score: scoreTable(t) }))
    .sort((a, b) => b.score - a.score || (b.rowCount || 0) - (a.rowCount || 0));

  return scored[0] || null;
}

function normalizeHeader(text, index) {
  const base = clean(text)
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return base || `col_${index + 1}`;
}

function tableToObjects(table) {
  if (!table || !Array.isArray(table.rows) || table.rows.length < 2) return [];

  let headerRowIndex = -1;
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i] || [];
    const nonBlank = row.filter((x) => clean(x)).length;
    if (nonBlank >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) return [];

  const headers = (table.rows[headerRowIndex] || []).map((cell, idx) =>
    normalizeHeader(cell, idx)
  );

  const out = [];
  for (let i = headerRowIndex + 1; i < table.rows.length; i++) {
    const row = table.rows[i] || [];
    if (!row.some((x) => clean(x))) continue;

    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = clean(row[idx] || "");
    });

    out.push(obj);
  }

  return out;
}

async function snapshotDom(page) {
  return await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();

    const selects = Array.from(document.querySelectorAll("select")).map((select, idx) => ({
      index: idx,
      id: select.id || "",
      name: select.name || "",
      class: clean(select.className || ""),
      optionCount: select.options.length,
      selectedValue: clean(select.value),
      selectedText: clean(
        select.options[select.selectedIndex]
          ? select.options[select.selectedIndex].textContent
          : ""
      ),
      options: Array.from(select.options).map((opt) => ({
        value: clean(opt.value),
        text: clean(opt.textContent),
      })),
    }));

    const buttons = Array.from(
      document.querySelectorAll('button, input[type="submit"], input[type="button"], a')
    ).map((el, idx) => ({
      index: idx,
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      name: el.getAttribute("name") || "",
      type: el.getAttribute("type") || "",
      text: clean(el.textContent || el.value || ""),
      title: clean(el.getAttribute("title") || ""),
      href: el.getAttribute("href") || "",
      onclick: el.getAttribute("onclick") || "",
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    }));

    const tables = Array.from(document.querySelectorAll("table")).map((table, idx) => {
      const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
        Array.from(tr.querySelectorAll("th,td")).map((cell) => clean(cell.textContent))
      );

      return {
        index: idx,
        id: table.id || "",
        class: clean(table.className || ""),
        rowCount: rows.length,
        columnCount: Math.max(0, ...rows.map((r) => r.length)),
        rows,
        preview: rows.slice(0, 20),
      };
    });

    return { selects, buttons, tables };
  });
}

async function saveState(page, rawDir, baseName, manifest) {
  const htmlPath = path.join(rawDir, `${baseName}.html`);
  const txtPath = path.join(rawDir, `${baseName}.txt`);
  const domPath = path.join(rawDir, `${baseName}__dom.json`);
  const screenshotPath = path.join(rawDir, `${baseName}.png`);

  const html = await page.content();
  const visibleText = await page.evaluate(() => document.body.innerText || "");
  const dom = await snapshotDom(page);

  writeText(htmlPath, html);
  writeText(txtPath, visibleText);
  writeJson(domPath, dom);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  addFile(manifest, {
    type: "html",
    filePath: htmlPath,
    url: page.url(),
    note: `Saved HTML: ${baseName}`,
  });

  addFile(manifest, {
    type: "text",
    filePath: txtPath,
    url: page.url(),
    note: `Saved visible text: ${baseName}`,
  });

  addFile(manifest, {
    type: "json",
    filePath: domPath,
    url: page.url(),
    note: `Saved DOM summary: ${baseName}`,
  });

  addFile(manifest, {
    type: "image",
    filePath: screenshotPath,
    url: page.url(),
    note: `Saved screenshot: ${baseName}`,
  });

  return dom;
}

async function openApprovedPage(page, manifest) {
  addVisitedUrl(manifest, START_URL);

  await page.goto(START_URL, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  await page.waitForFunction(
    () => document.querySelectorAll("select").length >= 3,
    { timeout: 30000 }
  ).catch(() => null);

  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);
}

async function setSelectByIdNormalized(page, selectId, desiredValue, desiredText = "") {
  await page.evaluate(({ selectId, desiredValue, desiredText }) => {
    const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

    const sel = document.getElementById(selectId);
    if (!sel) {
      throw new Error(`Select #${selectId} not found`);
    }

    const options = Array.from(sel.options);

    let opt = options.find((o) => norm(o.value) === norm(desiredValue));

    if (!opt && desiredText) {
      opt = options.find((o) => norm(o.textContent) === norm(desiredText));
    }

    if (!opt) {
      const available = options.map((o) => ({
        value: String(o.value || ""),
        text: String(o.textContent || "").replace(/\s+/g, " ").trim(),
      }));
      throw new Error(
        `Option "${desiredValue}" / "${desiredText}" not found in #${selectId}. Available: ${JSON.stringify(available.slice(0, 20))}`
      );
    }

    sel.value = opt.value;
    opt.selected = true;

    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, { selectId, desiredValue, desiredText });

  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
}

async function clickSearchInstitutes(page) {
  const clicked = await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim().toLowerCase();
    const controls = Array.from(
      document.querySelectorAll('button, input[type="submit"], input[type="button"], a')
    );

    let target = null;
    for (const el of controls) {
      const blob = [
        el.textContent || "",
        el.value || "",
        el.getAttribute("title") || "",
        el.getAttribute("onclick") || "",
      ]
        .map(clean)
        .join(" ");

      if (
        blob.includes("search institutes") ||
        blob.includes("click to search institutes") ||
        blob.includes("search institute")
      ) {
        target = el;
        break;
      }
    }

    if (!target) {
      return { clicked: false, reason: "search control not found" };
    }

    target.click();
    return {
      clicked: true,
      tag: target.tagName.toLowerCase(),
      id: target.id || "",
      name: target.getAttribute("name") || "",
      text: clean(target.textContent || target.value || ""),
    };
  });

  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);

  return clicked;
}

function flushProgress(rawDir, combinedRows, stateLog, targetStates, yearChoice) {
  const combinedJsonPath = path.join(rawDir, "combined_rows_progress.json");
  const combinedCsvPath = path.join(rawDir, "combined_rows_progress.csv");
  const stateLogPath = path.join(rawDir, "state_log.json");
  const summaryPath = path.join(rawDir, "final_summary.json");

  writeJson(combinedJsonPath, combinedRows);
  writeText(combinedCsvPath, rowsToCsv(combinedRows));
  writeJson(stateLogPath, stateLog);
  writeJson(summaryPath, {
    year: yearChoice,
    totalStatesTried: targetStates.length,
    successfulStates: stateLog.filter((x) => x.status !== "failed").length,
    failedStates: stateLog.filter((x) => x.status === "failed").length,
    totalRows: combinedRows.length,
  });

  return {
    combinedJsonPath,
    combinedCsvPath,
    stateLogPath,
    summaryPath,
  };
}

async function processOneState(context, manifest, dirs, yearChoice, state, index, total) {
  const page = await context.newPage();

  try {
    console.log(`\n[${index + 1}/${total}] ${state.text}`);

    await openApprovedPage(page, manifest);

    let dom = await snapshotDom(page);

    const yearSelect = findSelect(dom, "year");
    if (!yearSelect) throw new Error("Year select not found");

    await setSelectByIdNormalized(page, yearSelect.id, yearChoice.value, yearChoice.text);

    dom = await snapshotDom(page);

    const stateSelect = findSelect(dom, "state");
    if (!stateSelect) throw new Error("State select not found after year selection");

    await setSelectByIdNormalized(page, stateSelect.id, state.value, state.text);

    dom = await snapshotDom(page);

    const programSelect = findSelect(dom, "program");
    if (!programSelect) throw new Error("Program select not found after state selection");

    const programChoice = chooseProgram(programSelect);
    if (!programChoice) throw new Error("No usable program option found");

    await setSelectByIdNormalized(page, programSelect.id, programChoice.value, programChoice.text);

    const clickResult = await clickSearchInstitutes(page);

    const stateTag = `${String(index + START_STATE_INDEX + 1).padStart(2, "0")}_${safeName(state.text)}`;
    const stateDir = path.join(dirs.rawDir, stateTag);

    const finalDom = await saveState(page, stateDir, "after_search", manifest);

    const bestTable = pickBestTable(finalDom.tables || []);
    const rows = dedupeRows(tableToObjects(bestTable)).map((row) => ({
      admission_year: yearChoice.value,
      state: state.text,
      state_value: state.value,
      program_filter: programChoice.text,
      program_filter_value: programChoice.value,
      page_url: page.url(),
      extracted_at: new Date().toISOString(),
      ...row,
    }));

    const bestTablePath = path.join(stateDir, "best_table.json");
    const rowsJsonPath = path.join(stateDir, "rows.json");
    const rowsCsvPath = path.join(stateDir, "rows.csv");
    const summaryPath = path.join(stateDir, "summary.json");

    writeJson(bestTablePath, bestTable);
    writeJson(rowsJsonPath, rows);
    writeText(rowsCsvPath, rowsToCsv(rows));
    writeJson(summaryPath, {
      state,
      year: yearChoice,
      program: programChoice,
      clickResult,
      rowCount: rows.length,
      bestTable: bestTable
        ? {
            index: bestTable.index,
            id: bestTable.id,
            class: bestTable.class,
            rowCount: bestTable.rowCount,
            columnCount: bestTable.columnCount,
            score: bestTable.score,
          }
        : null,
    });

    console.log(
      `Saved state=${state.text} | program=${programChoice.text} | rows=${rows.length}`
    );

    return {
      status: "success",
      state: state.text,
      state_value: state.value,
      year: yearChoice.value,
      program_filter: programChoice.text,
      rowCount: rows.length,
      clickResult,
      rows,
      rowsJsonPath,
      rowsCsvPath,
    };
  } catch (err) {
    console.log(`FAILED state=${state.text} | ${String(err)}`);

    return {
      status: "failed",
      state: state.text,
      state_value: state.value,
      year: yearChoice.value,
      error: String(err),
      rows: [],
    };
  } finally {
    await page.close().catch(() => {});
  }
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

  const combinedRows = [];
  const stateLog = [];

  try {
    addNote(manifest, "Starting enhanced Playwright-only AICTE local dump.");

    // discovery page
    const discoveryPage = await context.newPage();
    await openApprovedPage(discoveryPage, manifest);

    let dom = await saveState(discoveryPage, dirs.rawDir, "step0_initial", manifest);

    const yearSelect = findSelect(dom, "year");
    if (!yearSelect) throw new Error("Year select not found on discovery page");

    const yearChoice = chooseYear(yearSelect);
    if (!yearChoice) throw new Error("No usable year option found");

    await setSelectByIdNormalized(
      discoveryPage,
      yearSelect.id,
      yearChoice.value,
      yearChoice.text
    );
    console.log("Selected year:", yearChoice.text, "|", yearChoice.value);

    dom = await saveState(discoveryPage, dirs.rawDir, "step1_year_selected", manifest);

    const stateSelect = findSelect(dom, "state");
    if (!stateSelect) throw new Error("State select not found after year selection");

    const allStates = validOptions(stateSelect);
    const targetStates = allStates.slice(
      START_STATE_INDEX,
      MAX_STATES ? START_STATE_INDEX + MAX_STATES : undefined
    );

    writeJson(path.join(dirs.rawDir, "state_options.json"), allStates);
    writeJson(path.join(dirs.rawDir, "target_states.json"), targetStates);

    await discoveryPage.close().catch(() => {});

    console.log("States to process:", targetStates.length);

    for (let i = 0; i < targetStates.length; i++) {
      const result = await processOneState(
        context,
        manifest,
        dirs,
        yearChoice,
        targetStates[i],
        i,
        targetStates.length
      );

      if (result.status === "success") {
        combinedRows.push(...result.rows);
      } else {
        addError(manifest, result.error, {
          stage: "state_iteration",
          state: result.state,
          stateValue: result.state_value,
        });
      }

      stateLog.push({
        state: result.state,
        state_value: result.state_value,
        year: result.year,
        status: result.status,
        program_filter: result.program_filter || "",
        rowCount: result.rowCount || 0,
        clickResult: result.clickResult || null,
        rowsJsonPath: result.rowsJsonPath || "",
        rowsCsvPath: result.rowsCsvPath || "",
        error: result.error || "",
      });

      flushProgress(dirs.rawDir, combinedRows, stateLog, targetStates, yearChoice);
    }

    const paths = flushProgress(
      dirs.rawDir,
      combinedRows,
      stateLog,
      targetStates,
      yearChoice
    );

    addFile(manifest, {
      type: "json",
      filePath: paths.combinedJsonPath,
      url: START_URL,
      note: "Combined AICTE rows JSON",
    });

    addFile(manifest, {
      type: "csv",
      filePath: paths.combinedCsvPath,
      url: START_URL,
      note: "Combined AICTE rows CSV",
    });

    addFile(manifest, {
      type: "json",
      filePath: paths.stateLogPath,
      url: START_URL,
      note: "AICTE state log",
    });

    addFile(manifest, {
      type: "json",
      filePath: paths.summaryPath,
      url: START_URL,
      note: "AICTE final summary",
    });

    addNote(
      manifest,
      `AICTE local dump completed. States=${targetStates.length}, Rows=${combinedRows.length}`
    );

    console.log("\nAICTE VISIBLE LOCAL DUMP COMPLETE");
    console.log("States tried         :", targetStates.length);
    console.log("Rows collected       :", combinedRows.length);
    console.log("Combined JSON        :", paths.combinedJsonPath);
    console.log("Combined CSV         :", paths.combinedCsvPath);
    console.log("State log            :", paths.stateLogPath);
    console.log("Final summary        :", paths.summaryPath);
  } catch (err) {
    addError(manifest, err, { stage: "main" });
    console.log("Dump failed:", String(err));
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close().catch(() => {});
    await browser.close().catch(() => {});

    console.log("\nAICTE VISIBLE LOCAL SCRIPT COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("AICTE VISIBLE LOCAL DUMP FAILED");
  console.error(err);
  process.exit(1);
});