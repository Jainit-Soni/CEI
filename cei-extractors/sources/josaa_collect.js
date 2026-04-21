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

const SOURCE_ID = "josaa";
const START_URL = "https://josaa.nic.in/or-cr/";

const PAGES = [
  "https://josaa.nic.in/or-cr/",
  "https://josaa.nic.in/archive/",
  "https://josaa.nic.in/news-event/",
  "https://josaa.admissions.nic.in/applicant/SeatAllotmentResult/CurrentORCR.aspx",
  "https://josaa.admissions.nic.in/applicant/seatmatrix/seatmatrixinfo.aspx",
];

function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function makeBaseName(url) {
  const u = new URL(url);
  const part =
    u.hostname.replace(/\./g, "_") +
    "__" +
    (u.pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "__") || "root");
  return safeName(part);
}

async function extractSelectOptions(page) {
  return await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();

    return Array.from(document.querySelectorAll("select")).map((select, idx) => ({
      index: idx + 1,
      id: select.id || "",
      name: select.name || "",
      optionCount: select.options.length,
      options: Array.from(select.options).map((opt) => ({
        value: clean(opt.value),
        text: clean(opt.textContent),
      })),
    }));
  });
}

async function extractAnchors(page, pageUrl) {
  return await page.evaluate((baseUrl) => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();

    const toAbs = (href) => {
      try {
        return new URL(href, baseUrl).href;
      } catch {
        return "";
      }
    };

    return Array.from(document.querySelectorAll("a")).map((a) => ({
      hrefRaw: a.getAttribute("href") || "",
      url: toAbs(a.getAttribute("href") || ""),
      text: clean(a.textContent),
      title: clean(a.getAttribute("title") || ""),
      onclick: a.getAttribute("onclick") || "",
    }));
  }, pageUrl);
}

async function savePageArtifacts(page, url, rawDir, manifest) {
  addVisitedUrl(manifest, url);

  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  const finalUrl = page.url();
  const status = response ? response.status() : null;
  const baseName = makeBaseName(finalUrl);

  const html = await page.content();
  const visibleText = await page.evaluate(() => document.body.innerText || "");
  const anchors = await extractAnchors(page, finalUrl);
  const selects = await extractSelectOptions(page);

  const htmlPath = path.join(rawDir, `${baseName}.html`);
  const txtPath = path.join(rawDir, `${baseName}.txt`);
  const anchorsPath = path.join(rawDir, `${baseName}__anchors.json`);
  const selectsPath = path.join(rawDir, `${baseName}__selects.json`);

  writeText(htmlPath, html);
  writeText(txtPath, visibleText);
  writeJson(anchorsPath, anchors);
  writeJson(selectsPath, selects);

  addFile(manifest, {
    type: "html",
    filePath: htmlPath,
    url: finalUrl,
    statusCode: status,
    note: "JoSAA page HTML",
  });

  addFile(manifest, {
    type: "text",
    filePath: txtPath,
    url: finalUrl,
    statusCode: status,
    note: "JoSAA visible page text",
  });

  addFile(manifest, {
    type: "json",
    filePath: anchorsPath,
    url: finalUrl,
    statusCode: status,
    note: "JoSAA anchors",
  });

  addFile(manifest, {
    type: "json",
    filePath: selectsPath,
    url: finalUrl,
    statusCode: status,
    note: "JoSAA select/dropdown options",
  });

  console.log("Saved page:", finalUrl);
  console.log("  anchors:", anchors.length);
  console.log("  selects:", selects.length);
}

async function main() {
  const dirs = makeRunDirs(SOURCE_ID);
  const manifest = createManifest(SOURCE_ID, dirs.runId, START_URL, dirs.rawDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();

  try {
    addNote(manifest, "Starting JoSAA page collection.");

    for (const url of dedupe(PAGES)) {
      try {
        await savePageArtifacts(page, url, dirs.rawDir, manifest);
      } catch (err) {
        addError(manifest, err, {
          stage: "save_page_artifacts",
          url,
        });
        console.log("Failed:", url);
      }
    }

    addNote(manifest, "JoSAA page collection completed.");
  } catch (err) {
    addError(manifest, err, { stage: "main" });
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close();
    await browser.close();

    console.log("\nJOSAA COLLECTION COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("JOSAA COLLECTION FAILED");
  console.error(err);
  process.exit(1);
});