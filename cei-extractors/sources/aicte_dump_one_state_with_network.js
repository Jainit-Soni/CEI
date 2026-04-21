const path = require("path");
const { chromium } = require("playwright");

const {
  makeRunDirs,
  writeText,
  writeJson,
  writeBuffer,
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

const SOURCE_ID = "aicte_one_state_network";
const START_URL =
  "https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php#!/approved";

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

function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extFromContentType(contentType, fallbackUrl = "") {
  const ct = String(contentType || "").toLowerCase();
  const u = String(fallbackUrl || "").toLowerCase();

  if (u.endsWith(".json") || ct.includes("json")) return "json";
  if (u.endsWith(".html") || ct.includes("html")) return "html";
  if (u.endsWith(".csv") || ct.includes("csv")) return "csv";
  if (u.endsWith(".pdf") || ct.includes("pdf")) return "pdf";
  if (u.endsWith(".txt") || ct.includes("text/plain")) return "txt";
  return "bin";
}

async function safeBody(response) {
  try {
    return Buffer.from(await response.body());
  } catch {
    return null;
  }
}

function normalizeHeader(text, index) {
  const base = clean(text)
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || `col_${index + 1}`;
}

function scoreTable(table) {
  const rows = table?.rows || [];
  const joined = rows.flat().join(" ").toLowerCase();
  const headers = (rows[0] || []).join(" ").toLowerCase();

  let score = 0;
  if (joined.includes("institute")) score += 20;
  if (joined.includes("state")) score += 12;
  if (joined.includes("program")) score += 10;
  if (joined.includes("course")) score += 10;
  if (joined.includes("approved")) score += 8;
  if (headers.includes("institute")) score += 12;
  if (headers.includes("state")) score += 8;
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
    if (row.length === 1 && /no data available in table/i.test(row[0])) continue;

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

      const columnCount = rows.length ? Math.max(...rows.map((r) => r.length)) : 0;

      return {
        index: idx,
        id: table.id || "",
        class: clean(table.className || ""),
        rowCount: rows.length,
        columnCount,
        rows,
        preview: rows.slice(0, 20),
      };
    });

    const messages = {
      showmessage: clean(document.getElementById("showmessage")?.textContent || ""),
      datafound: clean(document.getElementById("datafound")?.textContent || ""),
      facdatafound: clean(document.getElementById("facdatafound")?.textContent || ""),
      jsontable_info: clean(document.getElementById("jsontable_info")?.textContent || ""),
      titles: clean(document.getElementById("titles")?.textContent || ""),
    };

    return { selects, buttons, tables, messages };
  });
}

async function saveState(page, outDir, baseName, manifest) {
  const htmlPath = path.join(outDir, `${baseName}.html`);
  const txtPath = path.join(outDir, `${baseName}.txt`);
  const domPath = path.join(outDir, `${baseName}__dom.json`);
  const screenshotPath = path.join(outDir, `${baseName}.png`);

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
    note: `Saved text: ${baseName}`,
  });
  addFile(manifest, {
    type: "json",
    filePath: domPath,
    url: page.url(),
    note: `Saved DOM: ${baseName}`,
  });
  addFile(manifest, {
    type: "image",
    filePath: screenshotPath,
    url: page.url(),
    note: `Saved screenshot: ${baseName}`,
  });

  return dom;
}

function findSelect(dom, id) {
  return (dom.selects || []).find((s) => norm(s.id) === norm(id)) || null;
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

  const broadLabels = ["--All--", "All", "--all--"];
  for (const label of broadLabels) {
    const found = opts.find((o) => norm(o.text) === norm(label));
    if (found) return found;
  }

  return opts[0] || null;
}

async function setSelectByIdNormalized(page, selectId, desiredValue, desiredText = "") {
  await page.evaluate(({ selectId, desiredValue, desiredText }) => {
    const normalize = (v) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

    const sel = document.getElementById(selectId);
    if (!sel) throw new Error(`Select #${selectId} not found`);

    const options = Array.from(sel.options);

    let opt = options.find((o) => normalize(o.value) === normalize(desiredValue));
    if (!opt && desiredText) {
      opt = options.find((o) => normalize(o.textContent) === normalize(desiredText));
    }

    if (!opt) {
      const available = options.map((o) => ({
        value: String(o.value || ""),
        text: String(o.textContent || "").replace(/\s+/g, " ").trim(),
      }));
      throw new Error(
        `Option "${desiredValue}" / "${desiredText}" not found in #${selectId}. Available: ${JSON.stringify(available.slice(0, 30))}`
      );
    }

    sel.value = opt.value;
    opt.selected = true;
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, { selectId, desiredValue, desiredText });

  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
}

async function setInputById(page, inputId, value) {
  await page.evaluate(({ inputId, value }) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, { inputId, value });

  await page.waitForTimeout(400);
}

async function clickLoadButton(page) {
  const result = await page.evaluate(() => {
    const btn = document.getElementById("load");
    if (!btn) {
      return { clicked: false, reason: "#load not found" };
    }

    btn.click();

    return {
      clicked: true,
      id: btn.id || "",
      tag: btn.tagName.toLowerCase(),
      text: String(btn.textContent || btn.value || "").replace(/\s+/g, " ").trim(),
    };
  });

  await page.waitForFunction(() => {
    const msg = (document.getElementById("showmessage")?.textContent || "").toLowerCase();
    const info = (document.getElementById("jsontable_info")?.textContent || "").toLowerCase();
    const rows = document.querySelectorAll("#jsontable tbody tr").length;

    return (
      msg.includes("records found") ||
      msg.includes("no records found") ||
      info.includes("showing") ||
      rows > 0
    );
  }, { timeout: 20000 }).catch(() => null);

  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  return result;
}

async function extractJsonTableRows(page) {
  return await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
    const table = document.getElementById("jsontable");
    if (!table) return [];

    const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.querySelectorAll("th,td")).map((cell) => clean(cell.textContent))
    );

    if (rows.length < 2) return [];

    const headers = rows[0].map((h, idx) => {
      const base = clean(h)
        .toLowerCase()
        .replace(/[^\w]+/g, "_")
        .replace(/^_+|_+$/g, "");
      return base || `col_${idx + 1}`;
    });

    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row.some((x) => clean(x))) continue;
      if (row.length === 1 && /no data available in table/i.test(row[0])) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = clean(row[idx] || "");
      });
      out.push(obj);
    }

    return out;
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
  const responseLog = [];

  page.on("response", async (response) => {
    try {
      const request = response.request();
      const url = response.url();
      const status = response.status();
      const resourceType = request.resourceType();
      const headers = await response.allHeaders();
      const contentType = headers["content-type"] || "";

      let savedBodyPath = "";
      const body = await safeBody(response);

      if (
        ["xhr", "fetch"].includes(resourceType) ||
        contentType.toLowerCase().includes("json") ||
        contentType.toLowerCase().includes("html")
      ) {
        if (body && body.length > 0) {
          const ext = extFromContentType(contentType, url);
          const fileBase = safeName(
            `${Date.now()}_${request.method()}_${resourceType}_${new URL(url).hostname}_${new URL(url).pathname.split("/").pop() || "response"}`
          );
          savedBodyPath = path.join(dirs.rawDir, `${fileBase}.${ext}`);
          writeBuffer(savedBodyPath, body);

          addFile(manifest, {
            type: "network_body",
            filePath: savedBodyPath,
            url,
            statusCode: status,
            note: "Captured during one-state dump",
          });
        }
      }

      responseLog.push({
        time: new Date().toISOString(),
        url,
        method: request.method(),
        resourceType,
        status,
        contentType,
        requestPostData: request.postData() || "",
        savedBodyPath,
      });
    } catch (err) {
      addError(manifest, err, { stage: "response_capture" });
    }
  });

  try {
    addNote(manifest, "Starting one-state AICTE dump using #load and all real filters.");
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

    let dom = await saveState(page, dirs.rawDir, "step0_initial", manifest);

    const yearSelect = findSelect(dom, "year");
    const stateSelect = findSelect(dom, "state");
    const programSelect = findSelect(dom, "program");
    const levelSelect = findSelect(dom, "level");
    const institutionTypeSelect = findSelect(dom, "institutiontype");
    const womenSelect = findSelect(dom, "Women");
    const minoritySelect = findSelect(dom, "Minority");

    if (!yearSelect) throw new Error("Year select not found");
    if (!stateSelect) throw new Error("State select not found");
    if (!programSelect) throw new Error("Program select not found");

    const yearChoice = chooseOption(yearSelect, TARGET_YEAR, TARGET_YEAR);
    const stateChoice = chooseOption(stateSelect, TARGET_STATE, TARGET_STATE);
    const programChoice = chooseOption(programSelect, TARGET_PROGRAM, TARGET_PROGRAM);
    const levelChoice = levelSelect ? chooseOption(levelSelect, TARGET_LEVEL, TARGET_LEVEL) : null;
    const institutionTypeChoice = institutionTypeSelect
      ? chooseOption(institutionTypeSelect, TARGET_INSTITUTION_TYPE, TARGET_INSTITUTION_TYPE)
      : null;
    const womenChoice = womenSelect
      ? chooseOption(womenSelect, TARGET_WOMEN, TARGET_WOMEN)
      : null;
    const minorityChoice = minoritySelect
      ? chooseOption(minoritySelect, TARGET_MINORITY, TARGET_MINORITY)
      : null;

    if (!yearChoice) throw new Error("No usable year option found");
    if (!stateChoice) throw new Error("No usable state option found");
    if (!programChoice) throw new Error("No usable program option found");

    await setSelectByIdNormalized(page, yearSelect.id, yearChoice.value, yearChoice.text);
    console.log("Selected year         :", yearChoice.text, "|", yearChoice.value);

    await setSelectByIdNormalized(page, stateSelect.id, stateChoice.value, stateChoice.text);
    console.log("Selected state        :", stateChoice.text, "|", stateChoice.value);

    await setSelectByIdNormalized(page, programSelect.id, programChoice.value, programChoice.text);
    console.log("Selected program      :", programChoice.text, "|", programChoice.value);

    if (levelSelect && levelChoice) {
      await setSelectByIdNormalized(page, levelSelect.id, levelChoice.value, levelChoice.text);
      console.log("Selected level        :", levelChoice.text, "|", levelChoice.value);
    }

    if (institutionTypeSelect && institutionTypeChoice) {
      await setSelectByIdNormalized(
        page,
        institutionTypeSelect.id,
        institutionTypeChoice.value,
        institutionTypeChoice.text
      );
      console.log("Selected inst. type   :", institutionTypeChoice.text, "|", institutionTypeChoice.value);
    }

    if (womenSelect && womenChoice) {
      await setSelectByIdNormalized(page, womenSelect.id, womenChoice.value, womenChoice.text);
      console.log("Selected Women        :", womenChoice.text, "|", womenChoice.value);
    }

    if (minoritySelect && minorityChoice) {
      await setSelectByIdNormalized(page, minoritySelect.id, minorityChoice.value, minorityChoice.text);
      console.log("Selected Minority     :", minorityChoice.text, "|", minorityChoice.value);
    }

    await setInputById(page, "course", TARGET_COURSE);
    console.log("Set course input      :", TARGET_COURSE || "(blank)");

    dom = await saveState(page, dirs.rawDir, "step1_filters_set", manifest);

    const beforeCount = responseLog.length;
    const loadResult = await clickLoadButton(page);
    const afterCount = responseLog.length;

    console.log(
      "Clicked #load         :",
      loadResult.clicked ? "yes" : "no",
      "| newResponses=",
      afterCount - beforeCount
    );

    dom = await saveState(page, dirs.rawDir, "step2_after_load", manifest);

    const deltaResponses = responseLog.slice(beforeCount);
    const jsontableRows = dedupeRows(await extractJsonTableRows(page)).map((row) => ({
      admission_year: yearChoice.value,
      state: stateChoice.text,
      state_value: stateChoice.value,
      program_filter: programChoice.text,
      program_filter_value: programChoice.value,
      level_filter: levelChoice?.text || "",
      institutiontype_filter: institutionTypeChoice?.text || "",
      women_filter: womenChoice?.text || "",
      minority_filter: minorityChoice?.text || "",
      course_filter: TARGET_COURSE,
      page_url: page.url(),
      extracted_at: new Date().toISOString(),
      ...row,
    }));

    const bestTable = pickBestTable(dom.tables || []);
    const deltaPath = path.join(dirs.rawDir, "search_delta_responses.json");
    const rowsJsonPath = path.join(dirs.rawDir, "rows.json");
    const rowsCsvPath = path.join(dirs.rawDir, "rows.csv");
    const bestTablePath = path.join(dirs.rawDir, "best_table.json");
    const summaryPath = path.join(dirs.rawDir, "summary.json");

    writeJson(deltaPath, deltaResponses);
    writeJson(rowsJsonPath, jsontableRows);
    writeText(rowsCsvPath, rowsToCsv(jsontableRows));
    writeJson(bestTablePath, bestTable);
    writeJson(summaryPath, {
      runId: dirs.runId,
      yearChoice,
      stateChoice,
      programChoice,
      levelChoice,
      institutionTypeChoice,
      womenChoice,
      minorityChoice,
      courseFilter: TARGET_COURSE,
      loadResult,
      totalResponses: responseLog.length,
      newResponsesAfterLoad: deltaResponses.length,
      rowCount: jsontableRows.length,
      messages: dom.messages,
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
      topNewUrls: deltaResponses.map((r) => ({
        url: r.url,
        method: r.method,
        resourceType: r.resourceType,
        status: r.status,
        contentType: r.contentType,
        savedBodyPath: r.savedBodyPath,
      })),
    });

    addFile(manifest, {
      type: "json",
      filePath: deltaPath,
      url: page.url(),
      note: "New responses after #load",
    });
    addFile(manifest, {
      type: "json",
      filePath: rowsJsonPath,
      url: page.url(),
      note: "Extracted one-state rows JSON",
    });
    addFile(manifest, {
      type: "csv",
      filePath: rowsCsvPath,
      url: page.url(),
      note: "Extracted one-state rows CSV",
    });
    addFile(manifest, {
      type: "json",
      filePath: bestTablePath,
      url: page.url(),
      note: "Best detected table",
    });
    addFile(manifest, {
      type: "json",
      filePath: summaryPath,
      url: page.url(),
      note: "One-state dump summary",
    });

    addNote(
      manifest,
      `One-state AICTE dump completed. State=${stateChoice.text}, newResponses=${deltaResponses.length}, rows=${jsontableRows.length}`
    );

    console.log("\nAICTE ONE-STATE LOCAL DUMP COMPLETE");
    console.log("State               :", stateChoice.text);
    console.log("Messages            :", JSON.stringify(dom.messages));
    console.log("New responses       :", deltaResponses.length);
    console.log("Rows collected      :", jsontableRows.length);
    console.log("Search delta JSON   :", deltaPath);
    console.log("Rows JSON           :", rowsJsonPath);
    console.log("Rows CSV            :", rowsCsvPath);
    console.log("Best table JSON     :", bestTablePath);
    console.log("Summary JSON        :", summaryPath);
  } catch (err) {
    addError(manifest, err, { stage: "main" });
    console.log("Dump failed:", String(err));
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close().catch(() => {});
    await browser.close().catch(() => {});

    console.log("\nAICTE ONE-STATE SCRIPT COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("AICTE ONE-STATE LOCAL DUMP FAILED");
  console.error(err);
  process.exit(1);
});