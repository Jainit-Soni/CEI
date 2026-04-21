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

const SOURCE_ID = "aicte_probe_search_institutes_flow";
const START_URL =
  "https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php#!/approved";

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
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
      first20Options: Array.from(select.options)
        .slice(0, 20)
        .map((opt) => ({
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
        preview: rows.slice(0, 15),
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
    note: `Saved page HTML: ${baseName}`,
  });

  addFile(manifest, {
    type: "text",
    filePath: txtPath,
    url: page.url(),
    note: `Saved page text: ${baseName}`,
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

async function setSelectById(page, selectId, optionValue) {
  await page.evaluate(({ selectId, optionValue }) => {
    const sel = document.getElementById(selectId);
    if (!sel) {
      throw new Error(`Select #${selectId} not found`);
    }

    const opt = Array.from(sel.options).find(
      (o) => String(o.value) === String(optionValue)
    );

    if (!opt) {
      throw new Error(`Option "${optionValue}" not found in #${selectId}`);
    }

    sel.value = String(optionValue);
    opt.selected = true;

    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, { selectId, optionValue });

  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
}

function chooseYear(selects) {
  const sel = selects.find((s) => s.id === "year") || selects[0];
  if (!sel) return null;

  const preferred = (sel.first20Options || []).find((o) => o.value === "2025-2026");
  if (preferred) return { selectId: sel.id, ...preferred };

  const first = (sel.first20Options || []).find((o) => o.value || o.text);
  return first ? { selectId: sel.id, ...first } : null;
}

function chooseState(selects) {
  const sel = selects.find((s) => s.id === "state") || selects[1];
  if (!sel) return null;

  const preferredNames = ["Assam", "Gujarat", "Delhi"];
  for (const name of preferredNames) {
    const found = (sel.first20Options || []).find(
      (o) => clean(o.text).toLowerCase() === name.toLowerCase()
    );
    if (found) return { selectId: sel.id, ...found };
  }

  const first = (sel.first20Options || []).find((o) => o.value || o.text);
  return first ? { selectId: sel.id, ...first } : null;
}

function chooseProgram(selects) {
  const sel = selects.find((s) => s.id === "program") || selects[2];
  if (!sel) return null;

  const allOpt =
    (sel.first20Options || []).find((o) => /^--all--$/i.test(o.text)) ||
    (sel.first20Options || []).find((o) => /^all$/i.test(o.text)) ||
    (sel.first20Options || []).find((o) => o.value === "1");

  if (allOpt) return { selectId: sel.id, ...allOpt };

  const first = (sel.first20Options || []).find((o) => o.value || o.text);
  return first ? { selectId: sel.id, ...first } : null;
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
  await page.waitForTimeout(1800);

  return clicked;
}

async function main() {
  const dirs = makeRunDirs(SOURCE_ID);
  const manifest = createManifest(SOURCE_ID, dirs.runId, START_URL, dirs.rawDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    acceptDownloads: true,
  });

  const page = await context.newPage();

  const responseLog = [];
  const interactionLog = [];

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
            note: "Captured during search-institutes flow",
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
    addNote(manifest, "Starting AICTE search-institutes flow probe.");
    addVisitedUrl(manifest, START_URL);

    await page.goto(START_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    const initialDom = await saveState(page, dirs.rawDir, "step0_initial", manifest);

    const yearChoice = chooseYear(initialDom.selects || []);
    const stateChoice = chooseState(initialDom.selects || []);
    const programChoice = chooseProgram(initialDom.selects || []);

    if (!yearChoice) throw new Error("No year option found");
    if (!stateChoice) throw new Error("No state option found");
    if (!programChoice) throw new Error("No program option found");

    await setSelectById(page, yearChoice.selectId, yearChoice.value);
    interactionLog.push({
      step: "select_year",
      selectId: yearChoice.selectId,
      value: yearChoice.value,
      text: yearChoice.text,
    });
    console.log("Selected year   :", yearChoice.text, "|", yearChoice.value);
    await saveState(page, dirs.rawDir, "step1_year_selected", manifest);

    await setSelectById(page, stateChoice.selectId, stateChoice.value);
    interactionLog.push({
      step: "select_state",
      selectId: stateChoice.selectId,
      value: stateChoice.value,
      text: stateChoice.text,
    });
    console.log("Selected state  :", stateChoice.text, "|", stateChoice.value);
    await saveState(page, dirs.rawDir, "step2_state_selected", manifest);

    await setSelectById(page, programChoice.selectId, programChoice.value);
    interactionLog.push({
      step: "select_program",
      selectId: programChoice.selectId,
      value: programChoice.value,
      text: programChoice.text,
    });
    console.log("Selected program:", programChoice.text, "|", programChoice.value);
    await saveState(page, dirs.rawDir, "step3_program_selected", manifest);

    const beforeCount = responseLog.length;
    const clickResult = await clickSearchInstitutes(page);
    const afterCount = responseLog.length;

    interactionLog.push({
      step: "click_search_institutes",
      result: clickResult,
      newResponses: afterCount - beforeCount,
    });

    console.log(
      "Clicked search institutes:",
      clickResult.clicked ? "yes" : "no",
      "| newResponses=",
      afterCount - beforeCount
    );

    await saveState(page, dirs.rawDir, "step4_after_search", manifest);

    const deltaResponses = responseLog.slice(beforeCount);
    const deltaPath = path.join(dirs.rawDir, "search_flow_delta_responses.json");
    const interactionPath = path.join(dirs.rawDir, "interaction_log.json");
    const summaryPath = path.join(dirs.rawDir, "search_flow_summary.json");

    writeJson(deltaPath, deltaResponses);
    writeJson(interactionPath, interactionLog);
    writeJson(summaryPath, {
      runId: dirs.runId,
      finalUrl: page.url(),
      interactionLog,
      totalResponses: responseLog.length,
      newResponsesAfterSearch: deltaResponses.length,
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
      note: "New responses after Search Institutes click",
    });

    addFile(manifest, {
      type: "json",
      filePath: interactionPath,
      url: page.url(),
      note: "Interaction log",
    });

    addFile(manifest, {
      type: "json",
      filePath: summaryPath,
      url: page.url(),
      note: "Search-institutes flow summary",
    });

    addNote(
      manifest,
      `AICTE search-institutes flow completed. New responses after search=${deltaResponses.length}`
    );
  } catch (err) {
    addError(manifest, err, { stage: "main" });
    console.log("Flow probe failed:", String(err));
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close();
    await browser.close();

    console.log("\nAICTE SEARCH INSTITUTES FLOW COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("AICTE SEARCH INSTITUTES FLOW FAILED");
  console.error(err);
  process.exit(1);
});