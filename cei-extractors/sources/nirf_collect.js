const path = require("path");
const { chromium } = require("playwright");

const {
  makeRunDirs,
  writeText,
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

const SOURCE_ID = "nirf";
const START_URL = "https://www.nirfindia.org/Rankings/2025/Ranking.html";

const HTML_URLS = [
  "https://www.nirfindia.org/Rankings/2025/Ranking.html",
  "https://www.nirfindia.org/Rankings/2025/OverallRanking.html",
  "https://www.nirfindia.org/Rankings/2025/OverallRanking150.html",
  "https://www.nirfindia.org/Rankings/2025/OverallRanking200.html",
  "https://www.nirfindia.org/Rankings/2025/UniversityRanking.html",
  "https://www.nirfindia.org/Rankings/2025/UniversityRanking150.html",
  "https://www.nirfindia.org/Rankings/2025/UniversityRanking200.html",
  "https://www.nirfindia.org/Rankings/2025/CollegeRanking.html",
  "https://www.nirfindia.org/Rankings/2025/CollegeRanking150.html",
  "https://www.nirfindia.org/Rankings/2025/CollegeRanking200.html",
  "https://www.nirfindia.org/Rankings/2025/CollegeRanking300.html",
  "https://www.nirfindia.org/Rankings/2025/ResearchRanking.html",
  "https://www.nirfindia.org/Rankings/2025/EngineeringRanking.html",
  "https://www.nirfindia.org/Rankings/2025/EngineeringRanking150.html",
  "https://www.nirfindia.org/Rankings/2025/EngineeringRanking200.html",
  "https://www.nirfindia.org/Rankings/2025/EngineeringRanking300.html",
  "https://www.nirfindia.org/Rankings/2025/ManagementRanking.html",
  "https://www.nirfindia.org/Rankings/2025/ManagementRanking125.html",
  "https://www.nirfindia.org/Rankings/2025/PharmacyRanking.html",
  "https://www.nirfindia.org/Rankings/2025/MedicalRanking.html",
  "https://www.nirfindia.org/Rankings/2025/DentalRanking.html",
  "https://www.nirfindia.org/Rankings/2025/LawRanking.html",
  "https://www.nirfindia.org/Rankings/2025/ArchitectureRanking.html",
  "https://www.nirfindia.org/Rankings/2025/AgricultureRanking.html",
  "https://www.nirfindia.org/Rankings/2025/InnovationRanking.html",
  "https://www.nirfindia.org/Rankings/2025/OpenUniversityRanking.html",
  "https://www.nirfindia.org/Rankings/2025/SkillUniversityRanking.html",
  "https://www.nirfindia.org/Rankings/2025/STATEPUBLICUNIVERSITYRanking.html",
];

const PDF_URLS = [
  "https://www.nirfindia.org/nirfpdfcdn/2025/pdf/Report/IR2025_Report.pdf",
];

function dedupe(arr) {
  return [...new Set(arr)];
}

async function saveHtmlAndText(page, url, rawDir, manifest) {
  addVisitedUrl(manifest, url);

  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  const finalUrl = page.url();
  const status = response ? response.status() : null;

  const lastPart = new URL(finalUrl).pathname.split("/").pop() || "page.html";
  const baseName = safeName(lastPart.replace(/\?.*$/, "").replace(/\.html$/i, ""));

  const html = await page.content();
  const visibleText = await page.evaluate(() => document.body.innerText || "");

  const htmlPath = path.join(rawDir, `${baseName}.html`);
  const txtPath = path.join(rawDir, `${baseName}.txt`);

  writeText(htmlPath, html);
  writeText(txtPath, visibleText);

  addFile(manifest, {
    type: "html",
    filePath: htmlPath,
    url: finalUrl,
    statusCode: status,
    note: "Saved HTML from Playwright",
  });

  addFile(manifest, {
    type: "text",
    filePath: txtPath,
    url: finalUrl,
    statusCode: status,
    note: "Saved visible page text via document.body.innerText",
  });

  console.log("Saved:", finalUrl);
  console.log("  HTML ->", htmlPath);
  console.log("  TXT  ->", txtPath);
}

async function savePdf(apiContext, url, rawDir, manifest) {
  addVisitedUrl(manifest, url);

  const response = await apiContext.get(url, { timeout: 120000 });
  const status = response.status();

  if (!response.ok()) {
    throw new Error(`PDF request failed: ${status}`);
  }

  const buffer = Buffer.from(await response.body());
  const lastPart = new URL(url).pathname.split("/").pop() || "file.pdf";
  const fileName = safeName(lastPart);
  const filePath = path.join(rawDir, fileName);

  writeBuffer(filePath, buffer);

  addFile(manifest, {
    type: "pdf",
    filePath,
    url,
    statusCode: status,
    note: "Saved via Playwright API request",
  });

  console.log("Saved PDF:", filePath);
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
    addNote(manifest, "Starting NIRF collection with HTML + visible text.");

    for (const url of dedupe(HTML_URLS)) {
      try {
        await saveHtmlAndText(page, url, dirs.rawDir, manifest);
      } catch (err) {
        addError(manifest, err, { stage: "save_html_and_text", url });
        console.log("Failed:", url);
      }
    }

    const apiContext = await chromium.request.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    });

    for (const url of dedupe(PDF_URLS)) {
      try {
        await savePdf(apiContext, url, dirs.rawDir, manifest);
      } catch (err) {
        addError(manifest, err, { stage: "save_pdf", url });
        console.log("Failed PDF:", url);
      }
    }

    await apiContext.dispose();

    addNote(manifest, "NIRF collection with visible text completed.");
  } catch (err) {
    addError(manifest, err, { stage: "main" });
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close();
    await browser.close();

    console.log("\nNIRF TEXT COLLECTION COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("NIRF COLLECTION FAILED");
  console.error(err);
  process.exit(1);
});