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

const SOURCE_ID = "aicte_probe_approved_dashboard";

// Keep multiple candidates so the probe survives if one entry point changes.
// The first one is the historical dashboard-style entry point commonly used for approved data discovery.
const CANDIDATE_URLS = [
  "https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php#!/approved",
  "https://facilities.aicte-india.org/",
  "https://www.aicte-india.org/education/institutions/Universities",
];

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function isInterestingNetwork(url, resourceType, contentType = "") {
  const u = String(url || "").toLowerCase();
  const rt = String(resourceType || "").toLowerCase();
  const ct = String(contentType || "").toLowerCase();

  if (u.includes("google-analytics")) return false;
  if (u.includes("gstatic")) return false;

  if (rt === "xhr" || rt === "fetch") return true;

  if (u.includes("approved") || u.includes("dashboard") || u.includes("institute") || u.includes("course")) return true;
  if (u.includes("fetchdata") || u.includes("api") || u.includes("json")) return true;

  if (ct.includes("json") || ct.includes("text/html") || ct.includes("csv")) return true;

  return false;
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
      optionCount: select.options.length,
      selectedValue: clean(select.value),
      selectedText:
        clean(
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

    const inputs = Array.from(document.querySelectorAll("input, textarea")).map((el, idx) => ({
      index: idx,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type") || "",
      id: el.id || "",
      name: el.getAttribute("name") || "",
      value: clean(el.value || ""),
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
        Array.from(tr.querySelectorAll("th,td"))
          .map((cell) => clean(cell.textContent))
      );

      return {
        index: idx,
        rowCount: rows.length,
        preview: rows.slice(0, 15),
      };
    });

    return { selects, inputs, buttons, tables };
  });
}

async function savePageState(page, rawDir, baseName, manifest) {
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
    note: `Saved page visible text: ${baseName}`,
  });

  addFile(manifest, {
    type: "json",
    filePath: domPath,
    url: page.url(),
    note: `Saved page DOM summary: ${baseName}`,
  });

  addFile(manifest, {
    type: "image",
    filePath: screenshotPath,
    url: page.url(),
    note: `Saved screenshot: ${baseName}`,
  });

  return { htmlPath, txtPath, domPath, screenshotPath };
}

async function maybeClickUsefulControls(page, manifest) {
  const controls = await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
    return Array.from(
      document.querySelectorAll('button, input[type="submit"], input[type="button"], a')
    ).map((el, idx) => ({
      index: idx,
      tag: el.tagName.toLowerCase(),
      text: clean(el.textContent || el.value || ""),
      title: clean(el.getAttribute("title") || ""),
      href: el.getAttribute("href") || "",
      onclick: el.getAttribute("onclick") || "",
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    }));
  });

  const scored = controls
    .map((c) => {
      const blob = `${c.text} ${c.title} ${c.href} ${c.onclick}`.toLowerCase();
      let score = 0;
      if (!c.visible) score -= 10;
      if (blob.includes("approved")) score += 20;
      if (blob.includes("institut")) score += 15;
      if (blob.includes("course")) score += 12;
      if (blob.includes("program")) score += 10;
      if (blob.includes("view")) score += 8;
      if (blob.includes("search")) score += 8;
      if (blob.includes("submit")) score += 6;
      return { ...c, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  const clicked = [];

  for (const c of scored.slice(0, 3)) {
    try {
      const navPromise = page
        .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 })
        .catch(() => null);

      await page.evaluate((idx) => {
        const controls = Array.from(
          document.querySelectorAll('button, input[type="submit"], input[type="button"], a')
        );
        const el = controls[idx];
        if (!el) return;
        el.click();
      }, c.index);

      await navPromise;
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1200);

      clicked.push({
        index: c.index,
        text: c.text,
        title: c.title,
        href: c.href,
        onclick: c.onclick,
        finalUrl: page.url(),
      });

      addNote(manifest, `Clicked possible useful control: ${c.text || c.title || c.href || "(unnamed)"}`);
    } catch (err) {
      addError(manifest, err, {
        stage: "maybe_click_useful_controls",
        controlIndex: c.index,
        controlText: c.text,
      });
    }
  }

  return clicked;
}

async function main() {
  const dirs = makeRunDirs(SOURCE_ID);
  const manifest = createManifest(SOURCE_ID, dirs.runId, CANDIDATE_URLS[0], dirs.rawDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    acceptDownloads: true,
  });

  const page = await context.newPage();

  const requestLog = [];
  const responseLog = [];
  const downloadsLog = [];
  const clickedControls = [];

  page.on("request", (request) => {
    requestLog.push({
      time: new Date().toISOString(),
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      headers: request.headers(),
      postData: request.postData() || "",
    });
  });

  page.on("response", async (response) => {
    try {
      const request = response.request();
      const url = response.url();
      const status = response.status();
      const resourceType = request.resourceType();
      const headers = await response.allHeaders();
      const contentType = headers["content-type"] || "";

      const item = {
        time: new Date().toISOString(),
        url,
        status,
        resourceType,
        method: request.method(),
        contentType,
        headers,
        requestPostData: request.postData() || "",
      };

      if (isInterestingNetwork(url, resourceType, contentType)) {
        const body = await safeBody(response);
        if (body && body.length > 0) {
          const ext = extFromContentType(contentType, url);
          const fileBase = safeName(
            `${Date.now()}_${request.method()}_${resourceType}_${new URL(url).hostname}_${new URL(url).pathname.split("/").pop() || "response"}`
          );
          const filePath = path.join(dirs.rawDir, `${fileBase}.${ext}`);
          writeBuffer(filePath, body);

          item.savedBodyPath = filePath;

          addFile(manifest, {
            type: "network_body",
            filePath,
            url,
            statusCode: status,
            note: `Saved response body for ${resourceType} ${request.method()}`,
          });
        }
      }

      responseLog.push(item);
    } catch (err) {
      addError(manifest, err, { stage: "response_capture" });
    }
  });

  page.on("download", async (download) => {
    try {
      const suggested = safeName(download.suggestedFilename() || "download.bin");
      const filePath = path.join(dirs.rawDir, suggested);
      await download.saveAs(filePath);

      const item = {
        time: new Date().toISOString(),
        url: download.url(),
        filePath,
      };

      downloadsLog.push(item);

      addFile(manifest, {
        type: "download",
        filePath,
        url: download.url(),
        note: "Playwright download capture",
      });
    } catch (err) {
      addError(manifest, err, { stage: "download_capture" });
    }
  });

  try {
    addNote(manifest, "Starting AICTE approved dashboard probe.");

    let openedUrl = null;

    for (const url of dedupe(CANDIDATE_URLS)) {
      try {
        addVisitedUrl(manifest, url);

        const response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 120000,
        });

        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1500);

        if (response && response.status() < 400) {
          openedUrl = page.url();
          addNote(manifest, `Opened candidate URL successfully: ${url}`);
          break;
        }
      } catch (err) {
        addError(manifest, err, {
          stage: "open_candidate_url",
          url,
        });
      }
    }

    if (!openedUrl) {
      throw new Error("Could not open any AICTE candidate URL.");
    }

    await savePageState(page, dirs.rawDir, "step0_initial", manifest);

    const clicked = await maybeClickUsefulControls(page, manifest);
    clickedControls.push(...clicked);

    await savePageState(page, dirs.rawDir, "step1_after_clicks", manifest);

    const summary = {
      runId: dirs.runId,
      candidateUrls: CANDIDATE_URLS,
      finalUrl: page.url(),
      clickedControls,
      requestCount: requestLog.length,
      responseCount: responseLog.length,
      downloadCount: downloadsLog.length,
      interestingResponses: responseLog.filter((r) =>
        isInterestingNetwork(r.url, r.resourceType, r.contentType)
      ).length,
      requestPreview: requestLog.slice(-100),
      responsePreview: responseLog.slice(-100),
      downloads: downloadsLog,
    };

    const requestPath = path.join(dirs.rawDir, "request_log.json");
    const responsePath = path.join(dirs.rawDir, "response_log.json");
    const downloadPath = path.join(dirs.rawDir, "downloads_log.json");
    const summaryPath = path.join(dirs.rawDir, "probe_summary.json");

    writeJson(requestPath, requestLog);
    writeJson(responsePath, responseLog);
    writeJson(downloadPath, downloadsLog);
    writeJson(summaryPath, summary);

    addFile(manifest, {
      type: "json",
      filePath: requestPath,
      url: page.url(),
      note: "Full request log",
    });

    addFile(manifest, {
      type: "json",
      filePath: responsePath,
      url: page.url(),
      note: "Full response log",
    });

    addFile(manifest, {
      type: "json",
      filePath: downloadPath,
      url: page.url(),
      note: "Downloads log",
    });

    addFile(manifest, {
      type: "json",
      filePath: summaryPath,
      url: page.url(),
      note: "AICTE probe summary",
    });

    addNote(manifest, `AICTE probe completed. Requests=${requestLog.length}, Responses=${responseLog.length}, Downloads=${downloadsLog.length}`);
  } catch (err) {
    addError(manifest, err, { stage: "main" });
    console.log("Probe failed:", String(err));
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close();
    await browser.close();

    console.log("\nAICTE PROBE COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("AICTE PROBE FAILED");
  console.error(err);
  process.exit(1);
});