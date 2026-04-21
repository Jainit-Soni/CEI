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

const SOURCE_ID = "aicte_probe_approved_controls";
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

function scoreControl(c) {
  const blob = `${c.text} ${c.title} ${c.href} ${c.onclick} ${c.id} ${c.name}`.toLowerCase();
  let score = 0;

  if (!c.visible) score -= 10;
  if (blob.includes("approved")) score += 18;
  if (blob.includes("institute")) score += 18;
  if (blob.includes("course")) score += 14;
  if (blob.includes("program")) score += 14;
  if (blob.includes("state")) score += 10;
  if (blob.includes("view")) score += 10;
  if (blob.includes("search")) score += 10;
  if (blob.includes("submit")) score += 8;
  if (blob.includes("show")) score += 8;
  if (blob.includes("detail")) score += 8;

  return score;
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

    const controls = Array.from(
      document.querySelectorAll('button, input[type="submit"], input[type="button"], a')
    ).map((el, idx) => ({
      index: idx,
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      name: el.getAttribute("name") || "",
      type: el.getAttribute("type") || "",
      class: clean(el.getAttribute("class") || ""),
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

    return { selects, controls, tables };
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
    note: `Saved state HTML: ${baseName}`,
  });

  addFile(manifest, {
    type: "text",
    filePath: txtPath,
    url: page.url(),
    note: `Saved state TXT: ${baseName}`,
  });

  addFile(manifest, {
    type: "json",
    filePath: domPath,
    url: page.url(),
    note: `Saved state DOM: ${baseName}`,
  });

  addFile(manifest, {
    type: "image",
    filePath: screenshotPath,
    url: page.url(),
    note: `Saved state screenshot: ${baseName}`,
  });

  return dom;
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
  let interactionCounter = 0;

  page.on("response", async (response) => {
    try {
      const request = response.request();
      const url = response.url();
      const status = response.status();
      const resourceType = request.resourceType();
      const headers = await response.allHeaders();
      const contentType = headers["content-type"] || "";

      const body = await safeBody(response);
      let savedBodyPath = "";

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
            note: `Captured response body during control probe`,
          });
        }
      }

      responseLog.push({
        time: new Date().toISOString(),
        phase: interactionCounter,
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
    addNote(manifest, "Starting AICTE approved-controls interaction probe.");
    addVisitedUrl(manifest, START_URL);

    await page.goto(START_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    const initialDom = await saveState(page, dirs.rawDir, "step0_initial", manifest);

    const scoredControls = (initialDom.controls || [])
      .map((c) => ({ ...c, score: scoreControl(c) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    writeJson(path.join(dirs.rawDir, "candidate_controls.json"), scoredControls);

    for (const control of scoredControls) {
      interactionCounter += 1;

      try {
        addNote(
          manifest,
          `Trying control #${control.index}: ${control.text || control.title || control.href || "(unnamed)"}`
        );

        const beforeCount = responseLog.length;

        const navPromise = page
          .waitForNavigation({
            waitUntil: "domcontentloaded",
            timeout: 20000,
          })
          .catch(() => null);

        await page.evaluate((targetIndex) => {
          const controls = Array.from(
            document.querySelectorAll('button, input[type="submit"], input[type="button"], a')
          );
          const el = controls[targetIndex];
          if (!el) throw new Error(`Control not found at index ${targetIndex}`);
          el.click();
        }, control.index);

        await navPromise;
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1800);

        const afterCount = responseLog.length;
        const dom = await saveState(
          page,
          dirs.rawDir,
          `step${interactionCounter}_${safeName(control.text || control.title || control.id || String(control.index))}`,
          manifest
        );

        writeJson(
          path.join(dirs.rawDir, `step${interactionCounter}_network_delta.json`),
          responseLog.slice(beforeCount)
        );

        writeJson(
          path.join(dirs.rawDir, `step${interactionCounter}_dom_summary.json`),
          dom
        );

        console.log(
          `Clicked control #${control.index}: ${control.text || control.title || control.href || "(unnamed)"} | newResponses=${afterCount - beforeCount}`
        );

        // Reset to known base each time
        await page.goto(START_URL, {
          waitUntil: "domcontentloaded",
          timeout: 120000,
        });
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1500);
      } catch (err) {
        addError(manifest, err, {
          stage: "control_interaction",
          controlIndex: control.index,
          controlText: control.text,
        });
        console.log(
          `Failed control #${control.index}: ${control.text || control.title || control.href || "(unnamed)"}`
        );

        try {
          await page.goto(START_URL, {
            waitUntil: "domcontentloaded",
            timeout: 120000,
          });
          await page.waitForLoadState("networkidle").catch(() => {});
          await page.waitForTimeout(1500);
        } catch {}
      }
    }

    const summary = {
      runId: dirs.runId,
      finalUrl: page.url(),
      candidateControls: scoredControls,
      responseCount: responseLog.length,
    };

    writeJson(path.join(dirs.rawDir, "response_log.json"), responseLog);
    writeJson(path.join(dirs.rawDir, "probe_summary.json"), summary);

    addFile(manifest, {
      type: "json",
      filePath: path.join(dirs.rawDir, "response_log.json"),
      url: page.url(),
      note: "AICTE control-probe response log",
    });

    addFile(manifest, {
      type: "json",
      filePath: path.join(dirs.rawDir, "probe_summary.json"),
      url: page.url(),
      note: "AICTE control-probe summary",
    });

    addNote(manifest, `AICTE approved-controls probe completed. Responses captured=${responseLog.length}`);
  } catch (err) {
    addError(manifest, err, { stage: "main" });
    console.log("Probe failed:", String(err));
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close();
    await browser.close();

    console.log("\nAICTE APPROVED CONTROLS PROBE COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("AICTE APPROVED CONTROLS PROBE FAILED");
  console.error(err);
  process.exit(1);
});