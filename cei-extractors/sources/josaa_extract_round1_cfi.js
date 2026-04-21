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

const SOURCE_ID = "josaa_round1_cfi";
const START_URL =
  "https://josaa.admissions.nic.in/applicant/SeatAllotmentResult/CurrentORCR.aspx";

const ROUND_VALUE = "1";
const INSTITUTE_TYPE_VALUE = "CFI";
const MAX_INSTITUTES = 10;

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

function dedupeRows(rows) {
  const seen = new Set();

  return rows.filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeFinalRows(rows) {
  const seen = new Set();

  return rows.filter((row) => {
    const key = [
      row.round,
      row.institute_type_value,
      row.institute_name_value,
      row.program_value,
      row.seat_type_value,
      row.quota || "",
      row.seat_type || "",
      row.gender || "",
      row.opening_rank || "",
      row.closing_rank || "",
      row.source || "",
    ].join("||");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isPlaceholderText(text) {
  const t = clean(text).toLowerCase();
  return (
    t === "" ||
    t === "select" ||
    t === "--select--" ||
    t === "-- select --" ||
    t === "choose"
  );
}

function isAllText(text) {
  return /^all$/i.test(clean(text));
}

function validOptions(selectInfo, { skipAll = false } = {}) {
  const opts = (selectInfo?.options || []).map((o) => ({
    value: clean(o.value),
    text: clean(o.text),
  }));

  return opts.filter((o) => {
    if (!o.value && !o.text) return false;
    if (isPlaceholderText(o.text)) return false;
    if (skipAll && isAllText(o.text)) return false;
    return true;
  });
}

function chooseSeatTypeOption(selectInfo) {
  const opts = validOptions(selectInfo);

  const preferTexts = [
    "ALL",
    "OPEN",
    "OPEN (GENDER-NEUTRAL)",
    "OPEN (Gender-Neutral)",
    "OPEN (FEMALE ONLY)",
    "OPEN (Female Only)",
  ];

  for (const label of preferTexts) {
    const found = opts.find((o) => o.text.toUpperCase() === label.toUpperCase());
    if (found) return found;
  }

  return opts[0] || null;
}

async function openFreshPage(page, manifest) {
  addVisitedUrl(manifest, START_URL);

  await page.goto(START_URL, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
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

function addMeta(rows, meta) {
  return rows.map((row) => ({
    round: meta.round.text,
    round_value: meta.round.value,
    institute_type: meta.instituteType.text,
    institute_type_value: meta.instituteType.value,
    institute_name: meta.institute.text,
    institute_name_value: meta.institute.value,
    program: meta.program.text,
    program_value: meta.program.value,
    seat_type_selected: meta.seatType.text,
    seat_type_value: meta.seatType.value,
    page_url: meta.pageUrl,
    extracted_at: meta.extractedAt,
    ...row,
  }));
}

function summarize(allRows, comboLog, institutes) {
  const byInstitute = {};
  const byProgram = {};
  let successCombos = 0;
  let zeroRowCombos = 0;
  let failedCombos = 0;

  for (const c of comboLog) {
    if (c.status === "success") successCombos++;
    else if (c.status === "zero_rows") zeroRowCombos++;
    else if (c.status === "failed") failedCombos++;
  }

  for (const row of allRows) {
    byInstitute[row.institute_name] = (byInstitute[row.institute_name] || 0) + 1;
    byProgram[row.program] = (byProgram[row.program] || 0) + 1;
  }

  return {
    maxInstitutesConfigured: MAX_INSTITUTES,
    institutesSelected: institutes.length,
    combosTried: comboLog.length,
    successCombos,
    zeroRowCombos,
    failedCombos,
    totalRows: allRows.length,
    byInstitute,
    byProgram,
  };
}

async function prepareBaseState(page, manifest) {
  await openFreshPage(page, manifest);

  await postbackSelectByIndex(page, 0, ROUND_VALUE);
  await postbackSelectByIndex(page, 1, INSTITUTE_TYPE_VALUE);

  return await snapshotSelects(page);
}

async function prepareInstituteState(page, manifest, instituteValue) {
  const selectsAfterBase = await prepareBaseState(page, manifest);
  const instituteSelect = selectsAfterBase[2];

  const instituteOpt = validOptions(instituteSelect, { skipAll: true }).find(
    (o) => String(o.value) === String(instituteValue)
  );

  if (!instituteOpt) {
    throw new Error(`Institute option "${instituteValue}" not found`);
  }

  await postbackSelectByIndex(page, 2, instituteValue);

  const selectsAfterInstitute = await snapshotSelects(page);

  return {
    selects: selectsAfterInstitute,
    institute: instituteOpt,
    round: validOptions(selectsAfterBase[0]).find((o) => o.value === ROUND_VALUE),
    instituteType: validOptions(selectsAfterBase[1]).find((o) => o.value === INSTITUTE_TYPE_VALUE),
  };
}

function flushProgress(rawDir, allRows, comboLog, institutes, manifest) {
  const progressJsonPath = path.join(rawDir, "round1_cfi_progress.json");
  const progressCsvPath = path.join(rawDir, "round1_cfi_progress.csv");
  const comboLogPath = path.join(rawDir, "round1_cfi_combo_log.json");
  const institutesPath = path.join(rawDir, "round1_cfi_institutes.json");
  const summaryPath = path.join(rawDir, "round1_cfi_summary.json");

  const dedupedRows = dedupeFinalRows(allRows);
  const summary = summarize(dedupedRows, comboLog, institutes);

  writeJson(progressJsonPath, dedupedRows);
  writeText(progressCsvPath, rowsToCsv(dedupedRows));
  writeJson(comboLogPath, comboLog);
  writeJson(institutesPath, institutes);
  writeJson(summaryPath, summary);

  return {
    progressJsonPath,
    progressCsvPath,
    comboLogPath,
    institutesPath,
    summaryPath,
    dedupedRows,
    summary,
  };
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

  const allRows = [];
  const comboLog = [];
  let chosenInstitutes = [];

  try {
    addNote(manifest, "Starting JoSAA Round 1 + CFI extractor.");

    // Discover first 10 institutes
    const selectsAfterBase = await prepareBaseState(page, manifest);

    if (!selectsAfterBase[2]) {
      throw new Error("Institute select not found after base state");
    }

    chosenInstitutes = validOptions(selectsAfterBase[2], { skipAll: true })
      .slice(0, MAX_INSTITUTES);

    const institutesDiscoveryPath = path.join(dirs.rawDir, "discovered_institutes.json");
    writeJson(institutesDiscoveryPath, chosenInstitutes);

    addFile(manifest, {
      type: "json",
      filePath: institutesDiscoveryPath,
      url: page.url(),
      note: "First 10 chosen CFI institutes for Round 1",
    });

    console.log("Institutes selected:", chosenInstitutes.length);

    for (let instituteIndex = 0; instituteIndex < chosenInstitutes.length; instituteIndex++) {
      const institute = chosenInstitutes[instituteIndex];
      console.log(`\n[Institute ${instituteIndex + 1}/${chosenInstitutes.length}] ${institute.text}`);

      let instituteState;
      try {
        instituteState = await prepareInstituteState(page, manifest, institute.value);
      } catch (err) {
        comboLog.push({
          status: "failed",
          stage: "prepare_institute_state",
          institute_name: institute.text,
          institute_name_value: institute.value,
          error: String(err),
        });
        continue;
      }

      const programSelect = instituteState.selects[3];
      if (!programSelect) {
        comboLog.push({
          status: "failed",
          stage: "program_select_missing",
          institute_name: institute.text,
          institute_name_value: institute.value,
        });
        continue;
      }

      const programs = validOptions(programSelect, { skipAll: true });
      console.log("Programs found:", programs.length);

      for (let programIndex = 0; programIndex < programs.length; programIndex++) {
        const program = programs[programIndex];
        const comboPrefix = `[${instituteIndex + 1}/${chosenInstitutes.length}] [${programIndex + 1}/${programs.length}]`;

        try {
          const refreshedState = await prepareInstituteState(page, manifest, institute.value);

          const refreshedProgramSelect = refreshedState.selects[3];
          const currentProgram = validOptions(refreshedProgramSelect, { skipAll: true }).find(
            (o) => String(o.value) === String(program.value)
          );

          if (!currentProgram) {
            comboLog.push({
              status: "failed",
              stage: "program_not_found_after_refresh",
              institute_name: institute.text,
              institute_name_value: institute.value,
              program: program.text,
              program_value: program.value,
            });
            continue;
          }

          await postbackSelectByIndex(page, 3, program.value);

          const afterProgramSelects = await snapshotSelects(page);
          const seatSelect = afterProgramSelects[4];

          if (!seatSelect) {
            comboLog.push({
              status: "failed",
              stage: "seat_select_missing",
              institute_name: institute.text,
              institute_name_value: institute.value,
              program: program.text,
              program_value: program.value,
            });
            continue;
          }

          const seatOpt = chooseSeatTypeOption(seatSelect);
          if (!seatOpt) {
            comboLog.push({
              status: "failed",
              stage: "seat_option_missing",
              institute_name: institute.text,
              institute_name_value: institute.value,
              program: program.text,
              program_value: program.value,
            });
            continue;
          }

          await postbackSelectByIndex(page, 4, seatOpt.value);

          const action = await triggerBestAction(page);

          const finalText = await page.evaluate(() => document.body.innerText || "");
          const finalTables = await snapshotFullTables(page);
          const bestTable = findBestResultTable(finalTables);

          const tableRows = tableToObjects(bestTable);
          const textRows = extractRowsFromVisibleText(finalText);
          const mergedRows = dedupeRows([...tableRows, ...textRows]);

          const meta = {
            round: refreshedState.round || { text: "1", value: ROUND_VALUE },
            instituteType: refreshedState.instituteType || {
              text: "Government Funded Technical Institutions",
              value: INSTITUTE_TYPE_VALUE,
            },
            institute,
            program,
            seatType: seatOpt,
            pageUrl: page.url(),
            extractedAt: new Date().toISOString(),
          };

          const finalRows = addMeta(mergedRows, meta);
          allRows.push(...finalRows);

          comboLog.push({
            status: finalRows.length ? "success" : "zero_rows",
            institute_name: institute.text,
            institute_name_value: institute.value,
            program: program.text,
            program_value: program.value,
            seat_type_selected: seatOpt.text,
            seat_type_value: seatOpt.value,
            rows: finalRows.length,
            action_clicked: action
              ? (action.text || action.value || action.title || action.id || "")
              : "",
            page_url: page.url(),
          });

          if (!finalRows.length) {
            const zeroBase = safeName(
              `zero_${instituteIndex + 1}_${programIndex + 1}_${institute.text}_${program.text}`
            );

            writeText(
              path.join(dirs.rawDir, `${zeroBase}.txt`),
              finalText
            );
            writeJson(
              path.join(dirs.rawDir, `${zeroBase}__best_table.json`),
              bestTable
            );
          }

          const progress = flushProgress(
            dirs.rawDir,
            allRows,
            comboLog,
            chosenInstitutes,
            manifest
          );

          console.log(
            `${comboPrefix} ${program.text} | seat=${seatOpt.text} | rows=${finalRows.length} | total=${progress.summary.totalRows}`
          );
        } catch (err) {
          comboLog.push({
            status: "failed",
            stage: "combo_execution",
            institute_name: institute.text,
            institute_name_value: institute.value,
            program: program.text,
            program_value: program.value,
            error: String(err),
          });

          flushProgress(dirs.rawDir, allRows, comboLog, chosenInstitutes, manifest);

          console.log(
            `${comboPrefix} FAILED | ${program.text} | ${String(err)}`
          );
        }
      }
    }

    const finalProgress = flushProgress(
      dirs.rawDir,
      allRows,
      comboLog,
      chosenInstitutes,
      manifest
    );

    addFile(manifest, {
      type: "json",
      filePath: finalProgress.progressJsonPath,
      url: START_URL,
      note: "Round 1 CFI final rows JSON",
    });

    addFile(manifest, {
      type: "csv",
      filePath: finalProgress.progressCsvPath,
      url: START_URL,
      note: "Round 1 CFI final rows CSV",
    });

    addFile(manifest, {
      type: "json",
      filePath: finalProgress.comboLogPath,
      url: START_URL,
      note: "Round 1 CFI combo log",
    });

    addFile(manifest, {
      type: "json",
      filePath: finalProgress.institutesPath,
      url: START_URL,
      note: "Round 1 CFI selected institutes",
    });

    addFile(manifest, {
      type: "json",
      filePath: finalProgress.summaryPath,
      url: START_URL,
      note: "Round 1 CFI summary",
    });

    addNote(
      manifest,
      `Round 1 CFI extraction completed. Total rows: ${finalProgress.summary.totalRows}`
    );

    console.log("\nROUND 1 CFI EXTRACTION COMPLETE");
    console.log("Institutes selected :", finalProgress.summary.institutesSelected);
    console.log("Combos tried        :", finalProgress.summary.combosTried);
    console.log("Success combos      :", finalProgress.summary.successCombos);
    console.log("Zero-row combos     :", finalProgress.summary.zeroRowCombos);
    console.log("Failed combos       :", finalProgress.summary.failedCombos);
    console.log("Total rows          :", finalProgress.summary.totalRows);
    console.log("Rows JSON           :", finalProgress.progressJsonPath);
    console.log("Rows CSV            :", finalProgress.progressCsvPath);
    console.log("Combo log JSON      :", finalProgress.comboLogPath);
    console.log("Institutes JSON     :", finalProgress.institutesPath);
    console.log("Summary JSON        :", finalProgress.summaryPath);
  } catch (err) {
    addError(manifest, err, { stage: "main" });
    console.log("Extraction failed:", String(err));
  } finally {
    const manifestPath = saveManifest(manifest, dirs.manifestsDir);
    await context.close();
    await browser.close();

    console.log("\nJOSAA ROUND1 CFI SCRIPT COMPLETE");
    console.log("Run ID:", dirs.runId);
    console.log("Raw Dir:", dirs.rawDir);
    console.log("Manifest:", manifestPath);
  }
}

main().catch((err) => {
  console.error("JOSAA ROUND1 CFI EXTRACTION FAILED");
  console.error(err);
  process.exit(1);
});