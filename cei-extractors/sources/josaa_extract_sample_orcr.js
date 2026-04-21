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

const SOURCE_ID = "josaa_orcr_sample";
const START_URL =
  "https://josaa.admissions.nic.in/applicant/SeatAllotmentResult/CurrentORCR.aspx";

// First 4 are fixed because your probe already proved they work.
// Seat type is chosen dynamically later, preferring ALL/OPEN.
const FIXED_SELECTIONS = [
  { index: 0, label: "round", value: "1" },
  { index: 1, label: "institute_type", value: "CFI" },
  { index: 2, label: "institute_name", value: "401" },
  { index: 3, label: "program", value: "4110" },
];

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
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

async function snapshotSelects(page) {
  return await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();

    return Array.from(document.querySelectorAll("select")).map((select, idx) => ({
      index: idx,
      id: select.id || "",
      name: select.name || "",
      selectedValue: clean(select.value),
      selectedText:
        clean(
          select.options[select.selectedIndex]
            ? select.options[select.selectedIndex].textContent
            : ""
        ),
      optionCount: select.options.length,
      options: Array.from(select.options).map((opt) => ({
        value: clean(opt.value),
        text: clean(opt.textContent),
      })),
    }));
  });
}

async function snapshotFullTables(page) {
  return await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();

    return Array.from(document.querySelectorAll("table")).map((table, idx) => {
      const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
        Array.from(tr.querySelectorAll("th,td")).map((cell) => clean(cell.textContent))
      );

      return {
        index: idx,
        rowCount: rows.length,
        rows,
      };
    });
  });
}

async function snapshotButtons(page) {
  return await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();

    const controls = Array.from(
      document.querySelectorAll('button, input[type="submit"], input[type="button"], a')
    );

    return controls.map((el, idx) => ({
      index: idx,
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      name: el.getAttribute("name") || "",
      type: el.getAttribute("type") || "",
      text: clean(el.textContent || el.value || ""),
      value: clean(el.value || ""),
      title: clean(el.getAttribute("title") || ""),
      href: el.getAttribute("href") || "",
      onclick: el.getAttribute("onclick") || "",
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    }));
  });
}

async function saveState(page, rawDir, baseName, manifest) {
  const htmlPath = path.join(rawDir, `${baseName}.html`);
  const txtPath = path.join(rawDir, `${baseName}.txt`);
  const selectsPath = path.join(rawDir, `${baseName}__selects.json`);
  const tablesPath = path.join(rawDir, `${baseName}__tables_full.json`);
  const buttonsPath = path.join(rawDir, `${baseName}__buttons.json`);

  const html = await page.content();
  const text = await page.evaluate(() => document.body.innerText || "");
  const selects = await snapshotSelects(page);
  const tables = await snapshotFullTables(page);
  const buttons = await snapshotButtons(page);

  writeText(htmlPath, html);
  writeText(txtPath, text);
  writeJson(selectsPath, selects);
  writeJson(tablesPath, tables);
  writeJson(buttonsPath, buttons);

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
    note: `Saved TXT: ${baseName}`,
  });

  addFile(manifest, {
    type: "json",
    filePath: selectsPath,
    url: page.url(),
    note: `Saved selects: ${baseName}`,
  });

  addFile(manifest, {
    type: "json",
    filePath: tablesPath,
    url: page.url(),
    note: `Saved full tables: ${baseName}`,
  });

  addFile(manifest, {
    type: "json",
    filePath: buttonsPath,
    url: page.url(),
    note: `Saved buttons: ${baseName}`,
  });

  return { selects, tables, buttons };
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

    const eventTarget = sel.name || sel.id || "";
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
      throw new Error("Could not find __EVENTTARGET / __EVENTARGUMENT");
    }

    eventTargetInput.value = eventTarget;
    eventArgumentInput.value = "";

    const form = sel.form || document.forms[0];
    if (!form) {
      throw new Error("No form found for postback");
    }

    form.submit();
  }, { selectIndex, optionValue });

  await navPromise;
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
}

function chooseSeatTypeOption(selectInfo) {
  const opts = selectInfo.options || [];

  const normalized = opts.map((o) => ({
    value: clean(o.value),
    text: clean(o.text),
  }));

  const preferTexts = [
    "ALL",
    "OPEN",
    "OPEN (GENDER-NEUTRAL)",
    "OPEN (Gender-Neutral)",
    "OPEN (FEMALE ONLY)",
    "OPEN (Female Only)",
  ];

  for (const label of preferTexts) {
    const found = normalized.find((o) => o.text.toUpperCase() === label.toUpperCase());
    if (found) return found;
  }

  for (const o of normalized) {
    if (!o.value && !o.text) continue;
    if (/^--\s*select\s*--$/i.test(o.text)) continue;
    return o;
  }

  return null;
}

async function triggerBestAction(page) {
  const controls = await snapshotButtons(page);

  const scored = controls
    .map((c) => {
      const blob = `${c.text} ${c.value} ${c.title} ${c.onclick}`.toLowerCase();
      let score = 0;

      if (!c.visible) score -= 5;
      if (blob.includes("view")) score += 20;
      if (blob.includes("show")) score += 18;
      if (blob.includes("submit")) score += 16;
      if (blob.includes("search")) score += 14;
      if (blob.includes("opening")) score += 12;
      if (blob.includes("closing")) score += 12;
      if (blob.includes("rank")) score += 10;
      if (c.tag === "input" && c.type === "submit") score += 8;
      if (c.tag === "button") score += 6;

      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score <= 0) {
    return null;
  }

  const navPromise = page
    .waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 120000,
    })
    .catch(() => null);

  await page.evaluate((targetIndex) => {
    const controls = Array.from(
      document.querySelectorAll('button, input[type="submit"], input[type="button"], a')
    );
    const el = controls[targetIndex];
    if (!el) {
      throw new Error(`Action control not found at index ${targetIndex}`);
    }
    el.click();
  }, best.index);

  await navPromise;
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  return best;
}

function findBestResultTable(tables) {
  const scored = tables.map((table) => {
    const joined = table.rows
      .map((row) => row.join(" | "))
      .join(" || ")
      .toLowerCase();

    let score = 0;

    if (joined.includes("opening rank")) score += 20;
    if (joined.includes("closing rank")) score += 20;
    if (joined.includes("quota")) score += 12;
    if (joined.includes("seat type")) score += 12;
    if (joined.includes("gender")) score += 10;
    if (joined.includes("category")) score += 8;
    if (table.rowCount > 1) score += 4;

    return { ...table, score };
  });

  scored.sort((a, b) => b.score - a.score || b.rowCount - a.rowCount);
  return scored[0] || null;
}

function normalizeHeaderCell(text, index) {
  const base = clean(text)
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return base || `col_${index + 1}`;
}

function tableToObjects(table) {
  if (!table || !table.rows || table.rows.length < 2) return [];

  let headerRowIndex = -1;
  for (let i = 0; i < table.rows.length; i++) {
    const rowText = table.rows[i].join(" ").toLowerCase();
    if (
      rowText.includes("opening rank") ||
      rowText.includes("closing rank") ||
      rowText.includes("seat type") ||
      rowText.includes("quota")
    ) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) return [];

  const headers = table.rows[headerRowIndex].map((cell, idx) =>
    normalizeHeaderCell(cell, idx)
  );

  const out = [];
  for (let i = headerRowIndex + 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    if (!row.some((x) => clean(x))) continue;

    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = clean(row[idx] || "");
    });

    out.push(obj);
  }

  return out;
}

function extractRowsFromVisibleText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((x) => clean(x))
    .filter(Boolean);

  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const blob = lines[i].toLowerCase();
    if (
      blob.includes("opening rank") &&
      blob.includes("closing rank") &&
      (
        blob.includes("quota") ||
        blob.includes("seat type") ||
        blob.includes("gender")
      )
    ) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const out = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (
      lower.includes("opening/closing ranks for open seats represent crl") ||
      lower.includes("terms and conditions") ||
      lower.includes("hyperlink policy") ||
      lower.includes("privacy policy") ||
      lower.includes("copyright policy") ||
      lower.includes("disclaimer")
    ) {
      break;
    }

    const m = line.match(/^(.*?)\s+(\d+[P]?)\s+(\d+[P]?)$/i);
    if (!m) continue;

    const left = m[1];
    const opening_rank = m[2];
    const closing_rank = m[3];

    let quota = "";
    let gender = "";
    let seat_type = "";

    if (/gender-neutral/i.test(left)) {
      const idx = left.toLowerCase().indexOf("gender-neutral");
      gender = left.slice(idx).trim();
      const before = left.slice(0, idx).trim().split(/\s+/);
      quota = before[0] || "";
      seat_type = before.slice(1).join(" ");
    } else if (/female-only/i.test(left)) {
      const idx = left.toLowerCase().indexOf("female-only");
      gender = left.slice(idx).trim();
      const before = left.slice(0, idx).trim().split(/\s+/);
      quota = before[0] || "";
      seat_type = before.slice(1).join(" ");
    } else {
      const parts = left.split(/\s+/);
      quota = parts[0] || "";
      seat_type = parts.slice(1).join(" ");
    }

    out.push({
      quota,
      seat_type,
      gender,
      opening_rank,
      closing_rank,
      source: "visible_text",
      raw_line: line,
    });
  }

  return out;
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
    addNote(manifest, "Starting enhanced JoSAA sample ORCR extraction.");
    addVisitedUrl(manifest, START_URL);

    await page.goto(START_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);

    await saveState(page, dirs.rawDir, "step0_initial", manifest);

    const selectedSummary = [];

    for (const sel of FIXED_SELECTIONS) {
      const beforeSelects = await snapshotSelects(page);
      const current = beforeSelects[sel.index];

      if (!current) {
        throw new Error(`Select index ${sel.index} not found for ${sel.label}`);
      }

      const found = current.options.find(
        (opt) => String(opt.value) === String(sel.value)
      );

      if (!found) {
        throw new Error(
          `Value "${sel.value}" not found in select ${sel.label} at index ${sel.index}`
        );
      }

      await postbackSelectByIndex(page, sel.index, sel.value);

      const afterSelects = await snapshotSelects(page);
      const chosen = afterSelects[sel.index];

      console.log(`Selected ${sel.label}:`, found.text, "|", found.value);

      selectedSummary.push({
        label: sel.label,
        index: sel.index,
        value: found.value,
        text: found.text,
        selectedValueAfter: chosen ? chosen.selectedValue : "",
        selectedTextAfter: chosen ? chosen.selectedText : "",
      });

      await saveState(
        page,
        dirs.rawDir,
        `step_${sel.index + 1}_${safeName(sel.label)}`,
        manifest
      );
    }

    // Dynamic seat type/category selection
    const beforeSeatSelects = await snapshotSelects(page);
    const seatSelect = beforeSeatSelects[4];
    if (!seatSelect) {
      throw new Error("Seat type select not found at index 4");
    }

    const seatOpt = chooseSeatTypeOption(seatSelect);
    if (!seatOpt) {
      throw new Error("No usable seat type option found");
    }

    await postbackSelectByIndex(page, 4, seatOpt.value);

    const afterSeatSelects = await snapshotSelects(page);
    const chosenSeat = afterSeatSelects[4];

    console.log("Selected seat_type:", seatOpt.text, "|", seatOpt.value);

    selectedSummary.push({
      label: "seat_type",
      index: 4,
      value: seatOpt.value,
      text: seatOpt.text,
      selectedValueAfter: chosenSeat ? chosenSeat.selectedValue : "",
      selectedTextAfter: chosenSeat ? chosenSeat.selectedText : "",
    });

    await saveState(page, dirs.rawDir, "step_5_seat_type", manifest);

    // Optional final action control
    const action = await triggerBestAction(page);
    if (action) {
      console.log(
        "Clicked action control:",
        action.text || action.value || action.title || action.id || "(unnamed)"
      );
      selectedSummary.push({
        label: "action_control",
        index: action.index,
        value: action.value || "",
        text: action.text || "",
        tag: action.tag,
      });
      await saveState(page, dirs.rawDir, "step_6_after_action", manifest);
    } else {
      console.log("No final action control detected.");
    }

    // Final extraction
    const finalText = await page.evaluate(() => document.body.innerText || "");
    const finalTables = await snapshotFullTables(page);

    const bestTable = findBestResultTable(finalTables);
    const tableRows = tableToObjects(bestTable);
    const textRows = extractRowsFromVisibleText(finalText);
    const finalRows = dedupeRows([...tableRows, ...textRows]);

    const selectedPath = path.join(dirs.rawDir, "selected_filters.json");
    const tablesPath = path.join(dirs.rawDir, "final_tables_full.json");
    const bestTablePath = path.join(dirs.rawDir, "best_result_table.json");
    const textPath = path.join(dirs.rawDir, "final_visible_text.txt");
    const rowsJsonPath = path.join(dirs.rawDir, "sample_orcr_rows.json");
    const rowsCsvPath = path.join(dirs.rawDir, "sample_orcr_rows.csv");

    writeJson(selectedPath, selectedSummary);
    writeJson(tablesPath, finalTables);
    writeJson(bestTablePath, bestTable);
    writeText(textPath, finalText);
    writeJson(rowsJsonPath, finalRows);
    writeText(rowsCsvPath, rowsToCsv(finalRows));

    addFile(manifest, {
      type: "json",
      filePath: selectedPath,
      url: page.url(),
      note: "Selected filter summary",
    });

    addFile(manifest, {
      type: "json",
      filePath: tablesPath,
      url: page.url(),
      note: "All final tables",
    });

    addFile(manifest, {
      type: "json",
      filePath: bestTablePath,
      url: page.url(),
      note: "Best detected ORCR result table",
    });

    addFile(manifest, {
      type: "text",
      filePath: textPath,
      url: page.url(),
      note: "Final visible text",
    });

    addFile(manifest, {
      type: "json",
      filePath: rowsJsonPath,
      url: page.url(),
      note: "Extracted sample ORCR rows JSON",
    });

    addFile(manifest, {
      type: "csv",
      filePath: rowsCsvPath,
      url: page.url(),
      note: "Extracted sample ORCR rows CSV",
    });

    addNote(
      manifest,
      `Enhanced sample ORCR extraction completed. Extracted rows: ${finalRows.length}`
    );

    console.log("\nEXTRACTED SAMPLE ROWS:", finalRows.length);
    console.log("Selected filters JSON :", selectedPath);
    console.log("Final tables JSON     :", tablesPath);
    console.log("Best table JSON       :", bestTablePath);
    console.log("Final text TXT        :", textPath);
    console.log("Rows JSON             :", rowsJsonPath);
    console.log("Rows CSV              :", rowsCsvPath);
  } catch (err) {
    addError(manifest, err, { stage: "main" });
    console.log("Extraction failed:", String(err));
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close();
    await browser.close();

    console.log("\nJOSAA SAMPLE ORCR EXTRACTION COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("JOSAA SAMPLE ORCR EXTRACTION FAILED");
  console.error(err);
  process.exit(1);
});