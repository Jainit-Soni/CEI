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

const SOURCE_ID = "mcc";
const START_URL = "https://mcc.nic.in/current-events-ug/";

const SEED_PAGES = [
  "https://mcc.nic.in/current-events-ug/",
  "https://mcc.nic.in/current-events-pg/",
  "https://mcc.nic.in/archive-ug/",
  "https://mcc.nic.in/archive-pg/",
  "https://mcc.nic.in/news-events-ug-medical/",
  "https://mcc.nic.in/news-events-pg/",
  "https://mcc.nic.in/current-events-mds/",
  "https://mcc.nic.in/news-events-mds/",
];

function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function absUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return "";
  }
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function looksLikeDoc(url, text, title) {
  const u = String(url || "").toLowerCase();
  const t = `${text || ""} ${title || ""}`.toLowerCase();

  return (
    /\.(pdf|xls|xlsx|csv|zip|doc|docx)$/i.test(u) ||
    t.includes("view") ||
    t.includes("download") ||
    t.includes("seat matrix") ||
    t.includes("result") ||
    t.includes("vacancy") ||
    t.includes("schedule") ||
    t.includes("notice") ||
    t.includes("allotment") ||
    t.includes("admitted")
  );
}

function looksLikePagination(url) {
  return /\/page\/\d+\/?$/i.test(String(url || ""));
}

function looksLikeListing(url) {
  const u = String(url || "").toLowerCase();
  return (
    u.startsWith("https://mcc.nic.in/current-events") ||
    u.startsWith("https://mcc.nic.in/archive") ||
    u.startsWith("https://mcc.nic.in/news-events")
  );
}

function makeBaseNameFromUrl(url) {
  const u = new URL(url);
  const slug = u.pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "__") || "root";
  return safeName(slug);
}

function extFromContentType(contentType, fallbackUrl) {
  const ct = String(contentType || "").toLowerCase();
  const u = String(fallbackUrl || "").toLowerCase();

  if (u.endsWith(".pdf") || ct.includes("pdf")) return "pdf";
  if (u.endsWith(".xlsx") || ct.includes("spreadsheetml")) return "xlsx";
  if (u.endsWith(".xls") || ct.includes("ms-excel")) return "xls";
  if (u.endsWith(".csv") || ct.includes("csv")) return "csv";
  if (u.endsWith(".docx") || ct.includes("wordprocessingml")) return "docx";
  if (u.endsWith(".doc") || ct.includes("msword")) return "doc";
  if (u.endsWith(".zip") || ct.includes("zip")) return "zip";
  if (u.endsWith(".html") || ct.includes("html")) return "html";
  if (ct.includes("text/plain")) return "txt";
  return "bin";
}

async function saveListingPage(page, url, rawDir, manifest) {
  addVisitedUrl(manifest, url);

  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  const finalUrl = page.url();
  const status = response ? response.status() : null;
  const baseName = makeBaseNameFromUrl(finalUrl);

  const html = await page.content();
  const visibleText = await page.evaluate(() => document.body.innerText || "");
  const anchors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a")).map((a) => ({
      hrefRaw: a.getAttribute("href") || "",
      text: (a.textContent || "").replace(/\s+/g, " ").trim(),
      title: (a.getAttribute("title") || "").replace(/\s+/g, " ").trim(),
      onclick: a.getAttribute("onclick") || "",
    }));
  });

  const htmlPath = path.join(rawDir, `${baseName}.html`);
  const txtPath = path.join(rawDir, `${baseName}.txt`);
  const anchorsPath = path.join(rawDir, `${baseName}__anchors.json`);

  writeText(htmlPath, html);
  writeText(txtPath, visibleText);
  writeJson(anchorsPath, anchors);

  addFile(manifest, {
    type: "html",
    filePath: htmlPath,
    url: finalUrl,
    statusCode: status,
    note: "MCC listing HTML saved by Playwright",
  });

  addFile(manifest, {
    type: "text",
    filePath: txtPath,
    url: finalUrl,
    statusCode: status,
    note: "MCC listing visible text saved by Playwright",
  });

  addFile(manifest, {
    type: "json",
    filePath: anchorsPath,
    url: finalUrl,
    statusCode: status,
    note: "MCC listing anchors extracted from DOM",
  });

  console.log("Saved listing:", finalUrl);

  return {
    finalUrl,
    status,
    anchors: anchors.map((a) => ({
      ...a,
      url: absUrl(a.hrefRaw, finalUrl),
      pageUrl: finalUrl,
    })),
  };
}

async function saveDocument(apiContext, doc, rawDir, manifest) {
  addVisitedUrl(manifest, doc.url);

  const response = await apiContext.get(doc.url, {
    timeout: 120000,
  });

  const status = response.status();

  if (!response.ok()) {
    throw new Error(`GET ${doc.url} failed with status ${status}`);
  }

  const contentType = response.headers()["content-type"] || "";
  const ext = extFromContentType(contentType, doc.url);

  const baseName =
    safeName(
      (doc.text || doc.title || new URL(doc.url).pathname.split("/").pop() || "file")
        .replace(/\.(pdf|xls|xlsx|csv|zip|doc|docx|html|txt)$/i, "")
    ) || "file";

  const filePath = path.join(rawDir, `${baseName}.${ext}`);
  const buffer = Buffer.from(await response.body());

  writeBuffer(filePath, buffer);

  addFile(manifest, {
    type: "download",
    filePath,
    url: doc.url,
    statusCode: status,
    contentType,
    note: `${doc.text || doc.title || "MCC document"} | source page: ${doc.pageUrl}`,
  });

  console.log("Downloaded:", doc.url);
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

  const queue = [...SEED_PAGES];
  const visited = new Set();
  const allAnchors = [];
  const docCandidates = [];

  try {
    addNote(manifest, "Starting MCC Playwright listing collection.");

    while (queue.length) {
      const pageUrl = queue.shift();
      if (visited.has(pageUrl)) continue;
      visited.add(pageUrl);

      try {
        const saved = await saveListingPage(page, pageUrl, dirs.rawDir, manifest);
        const anchors = saved.anchors;
        allAnchors.push(...anchors);

        console.log("  anchors:", anchors.length);

        for (const a of anchors) {
          if (looksLikeListing(a.url) && looksLikePagination(a.url) && !visited.has(a.url)) {
            queue.push(a.url);
          }

          if (looksLikeDoc(a.url, a.text, a.title)) {
            docCandidates.push(a);
          }
        }
      } catch (err) {
        addError(manifest, err, {
          stage: "save_listing_page",
          url: pageUrl,
        });
        console.log("Failed listing:", pageUrl);
      }
    }

    const uniqueAnchors = dedupe(allAnchors.map((x) => JSON.stringify(x))).map((s) => JSON.parse(s));
    const uniqueDocs = dedupe(docCandidates.map((x) => x.url)).map((url) =>
      docCandidates.find((x) => x.url === url)
    );

    const anchorsOut = path.join(dirs.rawDir, "listing_anchors.json");
    const docsOut = path.join(dirs.rawDir, "candidate_documents.json");

    writeJson(anchorsOut, uniqueAnchors);
    writeJson(docsOut, uniqueDocs);

    addFile(manifest, {
      type: "json",
      filePath: anchorsOut,
      note: "All MCC anchors",
    });

    addFile(manifest, {
      type: "json",
      filePath: docsOut,
      note: "Candidate MCC documents",
    });

    addNote(manifest, `Unique anchors: ${uniqueAnchors.length}`);
    addNote(manifest, `Candidate documents: ${uniqueDocs.length}`);

    console.log("Unique anchors:", uniqueAnchors.length);
    console.log("Candidate docs:", uniqueDocs.length);

    const apiContext = await chromium.request.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    });

    for (const doc of uniqueDocs) {
      try {
        await saveDocument(apiContext, doc, dirs.rawDir, manifest);
      } catch (err) {
        addError(manifest, err, {
          stage: "download_document",
          url: doc.url,
          pageUrl: doc.pageUrl,
        });
        console.log("Failed doc :", doc.url);
      }
    }

    await apiContext.dispose();

    addNote(manifest, "MCC Playwright collection completed.");
  } catch (err) {
    addError(manifest, err, {
      stage: "main",
    });
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close();
    await browser.close();

    console.log("\nMCC PLAYWRIGHT COLLECTION COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("MCC COLLECTION FAILED");
  console.error(err);
  process.exit(1);
});