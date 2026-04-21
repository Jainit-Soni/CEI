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

const SOURCE_ID = "josaa_orcr_probe";
const START_URL =
  "https://josaa.admissions.nic.in/applicant/SeatAllotmentResult/CurrentORCR.aspx";

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

async function snapshotSelects(page) {
  return await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();

    return Array.from(document.querySelectorAll("select")).map((select, idx) => ({
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
      options: Array.from(select.options).map((opt) => ({
        value: clean(opt.value),
        text: clean(opt.textContent),
      })),
    }));
  });
}

async function snapshotTables(page) {
  return await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();

    return Array.from(document.querySelectorAll("table")).map((table, idx) => {
      const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
        Array.from(tr.querySelectorAll("th,td")).map((cell) => clean(cell.textContent))
      );

      return {
        index: idx,
        rowCount: rows.length,
        preview: rows.slice(0, 15),
      };
    });
  });
}

async function snapshotHiddenFields(page) {
  return await page.evaluate(() => {
    const findVal = (name) => {
      const el =
        document.querySelector(`input[name="${name}"]`) ||
        document.getElementById(name);
      return el ? el.value || "" : "";
    };

    return {
      __EVENTTARGET: findVal("__EVENTTARGET"),
      __EVENTARGUMENT: findVal("__EVENTARGUMENT"),
      __VIEWSTATE_length: findVal("__VIEWSTATE").length,
      __VIEWSTATEGENERATOR: findVal("__VIEWSTATEGENERATOR"),
      __EVENTVALIDATION_length: findVal("__EVENTVALIDATION").length,
    };
  });
}

async function saveProbeState(page, rawDir, name, manifest) {
  const base = safeName(name);
  const htmlPath = path.join(rawDir, `${base}.html`);
  const txtPath = path.join(rawDir, `${base}.txt`);
  const selectsPath = path.join(rawDir, `${base}__selects.json`);
  const tablesPath = path.join(rawDir, `${base}__tables.json`);
  const hiddenPath = path.join(rawDir, `${base}__hidden.json`);

  const html = await page.content();
  const text = await page.evaluate(() => document.body.innerText || "");
  const selects = await snapshotSelects(page);
  const tables = await snapshotTables(page);
  const hidden = await snapshotHiddenFields(page);

  writeText(htmlPath, html);
  writeText(txtPath, text);
  writeJson(selectsPath, selects);
  writeJson(tablesPath, tables);
  writeJson(hiddenPath, hidden);

  addFile(manifest, {
    type: "html",
    filePath: htmlPath,
    url: page.url(),
    note: `Probe state HTML: ${name}`,
  });

  addFile(manifest, {
    type: "text",
    filePath: txtPath,
    url: page.url(),
    note: `Probe state text: ${name}`,
  });

  addFile(manifest, {
    type: "json",
    filePath: selectsPath,
    url: page.url(),
    note: `Probe state selects: ${name}`,
  });

  addFile(manifest, {
    type: "json",
    filePath: tablesPath,
    url: page.url(),
    note: `Probe state tables: ${name}`,
  });

  addFile(manifest, {
    type: "json",
    filePath: hiddenPath,
    url: page.url(),
    note: `Probe hidden fields: ${name}`,
  });

  console.log("Saved probe state:", name);
}

function chooseOption(selectInfo, rules = {}) {
  const opts = selectInfo.options || [];

  const isPlaceholder = (text) =>
    /^--\s*select\s*--$/i.test(text) ||
    /^select$/i.test(text) ||
    /^choose$/i.test(text);

  const isAll = (text) => /^all$/i.test(text);

  if (rules.preferValue) {
    const found = opts.find((o) => clean(o.value) === String(rules.preferValue));
    if (found) return found;
  }

  if (rules.preferText) {
    const found = opts.find((o) => clean(o.text) === String(rules.preferText));
    if (found) return found;
  }

  for (const opt of opts) {
    const value = clean(opt.value);
    const text = clean(opt.text);

    if (!value && !text) continue;
    if (isPlaceholder(text)) continue;
    if (rules.skipAll && isAll(text)) continue;

    return opt;
  }

  return null;
}

async function postbackSelectByIndex(page, selectIndex, optionValue) {
  const navPromise = page
    .waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 120000,
    })
    .catch(() => null);

  await page.evaluate(({ selectIndex, optionValue }) => {
    const selects = Array.from(document.querySelectorAll("select"));
    const sel = selects[selectIndex];

    if (!sel) {
      throw new Error(`No select found at index ${selectIndex}`);
    }

    const opt = Array.from(sel.options).find(
      (o) => String(o.value) === String(optionValue)
    );

    if (!opt) {
      throw new Error(
        `Option value "${optionValue}" not found in select index ${selectIndex}`
      );
    }

    sel.value = String(optionValue);
    opt.selected = true;

    const eventTarget =
      sel.name ||
      sel.id ||
      "";

    if (!eventTarget) {
      throw new Error(`No usable event target for select index ${selectIndex}`);
    }

    const eventTargetInput =
      document.querySelector('input[name="__EVENTTARGET"]') ||
      document.getElementById("__EVENTTARGET");

    const eventArgumentInput =
      document.querySelector('input[name="__EVENTARGUMENT"]') ||
      document.getElementById("__EVENTARGUMENT");

    if (!eventTargetInput || !eventArgumentInput) {
      throw new Error("Could not find __EVENTTARGET / __EVENTARGUMENT fields");
    }

    eventTargetInput.value = eventTarget;
    eventArgumentInput.value = "";

    const form = sel.form || document.forms[0];
    if (!form) {
      throw new Error("No form found for WebForms postback");
    }

    form.submit();
  }, { selectIndex, optionValue });

  await navPromise;
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
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

  const probeSummary = {
    startUrl: START_URL,
    steps: [],
  };

  try {
    addNote(manifest, "Starting enhanced live JoSAA OR-CR probe.");
    addVisitedUrl(manifest, START_URL);

    await page.goto(START_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);

    await saveProbeState(page, dirs.rawDir, "step0_initial", manifest);

    let selects = await snapshotSelects(page);
    console.log("Initial selects:", selects.length);

    if (selects.length < 5) {
      throw new Error(`Expected at least 5 selects, found ${selects.length}`);
    }

    // Step 1: Round
    const roundOpt =
      chooseOption(selects[0], { preferValue: "1" }) ||
      chooseOption(selects[0], { preferText: "1" }) ||
      chooseOption(selects[0]);

    if (!roundOpt) throw new Error("No usable round option found.");

    await postbackSelectByIndex(page, 0, roundOpt.value);
    console.log("Selected Round:", roundOpt.text, "|", roundOpt.value);
    probeSummary.steps.push({
      step: "round",
      value: roundOpt.value,
      text: roundOpt.text,
    });
    await saveProbeState(page, dirs.rawDir, "step1_round_selected", manifest);

    // Step 2: Institute Type
    selects = await snapshotSelects(page);
    const instituteTypeOpt = chooseOption(selects[1], { skipAll: true });
    if (!instituteTypeOpt) throw new Error("No usable institute type option found.");

    await postbackSelectByIndex(page, 1, instituteTypeOpt.value);
    console.log("Selected Institute Type:", instituteTypeOpt.text, "|", instituteTypeOpt.value);
    probeSummary.steps.push({
      step: "institute_type",
      value: instituteTypeOpt.value,
      text: instituteTypeOpt.text,
    });
    await saveProbeState(page, dirs.rawDir, "step2_institute_type_selected", manifest);

    // Step 3: Institute Name
    selects = await snapshotSelects(page);
    const instituteNameOpt = chooseOption(selects[2], { skipAll: true });
    if (!instituteNameOpt) throw new Error("No usable institute name option found.");

    await postbackSelectByIndex(page, 2, instituteNameOpt.value);
    console.log("Selected Institute Name:", instituteNameOpt.text, "|", instituteNameOpt.value);
    probeSummary.steps.push({
      step: "institute_name",
      value: instituteNameOpt.value,
      text: instituteNameOpt.text,
    });
    await saveProbeState(page, dirs.rawDir, "step3_institute_name_selected", manifest);

    // Step 4: Program
    selects = await snapshotSelects(page);
    const programOpt = chooseOption(selects[3], { skipAll: true });
    if (!programOpt) throw new Error("No usable academic program option found.");

    await postbackSelectByIndex(page, 3, programOpt.value);
    console.log("Selected Program:", programOpt.text, "|", programOpt.value);
    probeSummary.steps.push({
      step: "program",
      value: programOpt.value,
      text: programOpt.text,
    });
    await saveProbeState(page, dirs.rawDir, "step4_program_selected", manifest);

    // Step 5: Seat Type / Category
    selects = await snapshotSelects(page);
    const seatTypeOpt = chooseOption(selects[4], { skipAll: true });
    if (!seatTypeOpt) throw new Error("No usable seat type option found.");

    await postbackSelectByIndex(page, 4, seatTypeOpt.value);
    console.log("Selected Seat Type:", seatTypeOpt.text, "|", seatTypeOpt.value);
    probeSummary.steps.push({
      step: "seat_type",
      value: seatTypeOpt.value,
      text: seatTypeOpt.text,
    });
    await saveProbeState(page, dirs.rawDir, "step5_seat_type_selected", manifest);

    const summaryPath = path.join(dirs.rawDir, "probe_summary.json");
    writeJson(summaryPath, probeSummary);

    addFile(manifest, {
      type: "json",
      filePath: summaryPath,
      url: page.url(),
      note: "JoSAA ORCR probe summary",
    });

    addNote(manifest, "Enhanced live JoSAA OR-CR probe completed.");
  } catch (err) {
    addError(manifest, err, { stage: "main" });
    console.log("Probe failed:", String(err));
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close();
    await browser.close();

    console.log("\nJOSAA ORCR PROBE COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("JOSAA ORCR PROBE FAILED");
  console.error(err);
  process.exit(1);
});