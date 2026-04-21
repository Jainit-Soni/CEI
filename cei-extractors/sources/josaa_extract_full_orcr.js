const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "cei-extractors", "output");
const RAW_BASE_DIR = path.join(OUTPUT_DIR, "raw");
const MANIFESTS_DIR = path.join(OUTPUT_DIR, "manifests");

const START_URL =
  "https://josaa.admissions.nic.in/applicant/SeatAllotmentResult/CurrentORCR.aspx";

const HEADLESS = String(process.env.HEADLESS || "true").toLowerCase() !== "false";
const PLAYWRIGHT_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_TIMEOUT_MS || 60000);
const THROTTLE_MS = Number(process.env.THROTTLE_MS || 150);
const SNAPSHOT_ON_FAILURE =
  String(process.env.SNAPSHOT_ON_FAILURE || "true").toLowerCase() !== "false";

const ONLY_ROUND_VALUE = clean(process.env.ONLY_ROUND_VALUE || "");
const ONLY_ROUND_TEXT = clean(process.env.ONLY_ROUND_TEXT || "");
const ONLY_INSTITUTE_TYPE_VALUE = clean(process.env.ONLY_INSTITUTE_TYPE_VALUE || "");
const ONLY_INSTITUTE_TYPE_TEXT = clean(process.env.ONLY_INSTITUTE_TYPE_TEXT || "");
const MAX_ROUNDS = envIntOrNull(process.env.MAX_ROUNDS);
const MAX_INSTITUTE_TYPES = envIntOrNull(process.env.MAX_INSTITUTE_TYPES);
const MAX_INSTITUTES = envIntOrNull(process.env.MAX_INSTITUTES);
const MAX_PROGRAMS = envIntOrNull(process.env.MAX_PROGRAMS);
const MAX_COMBOS = envIntOrNull(process.env.MAX_COMBOS);

const SEAT_MODE = clean(process.env.SEAT_MODE || "all_option"); // all_option | each_option
const RETRY_FAILED = String(process.env.RETRY_FAILED || "false").toLowerCase() === "true";
const RESUME_PROGRESS_PATH = clean(process.env.RESUME_PROGRESS_PATH || "");

function envIntOrNull(v) {
  const s = clean(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function norm(text) {
  return clean(text).toLowerCase();
}

function safeName(text) {
  return clean(text)
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 140);
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function appendNdjson(filePath, data) {
  fs.appendFileSync(filePath, `${JSON.stringify(data)}\n`, "utf8");
}

function readNdjson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  const out = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch {}
  }
  return out;
}

function createRunContext() {
  if (RESUME_PROGRESS_PATH && fs.existsSync(RESUME_PROGRESS_PATH)) {
    const progress = JSON.parse(fs.readFileSync(RESUME_PROGRESS_PATH, "utf8"));
    const rawDir = path.dirname(RESUME_PROGRESS_PATH);
    const runId = path.basename(rawDir);

    return {
      runId,
      rawDir,
      progressPath: RESUME_PROGRESS_PATH,
      manifestPath: path.join(MANIFESTS_DIR, `${runId}.json`),
      resultsPath: path.join(rawDir, "orcr_rows.ndjson"),
      comboLogPath: path.join(rawDir, "combo_log.ndjson"),
      failureDir: path.join(rawDir, "failure_snapshots"),
      progress,
      resumed: true,
    };
  }

  const runId = `josaa_full_orcr_${nowStamp()}`;
  const rawDir = path.join(RAW_BASE_DIR, runId);
  ensureDir(rawDir);
  ensureDir(MANIFESTS_DIR);

  return {
    runId,
    rawDir,
    progressPath: path.join(rawDir, "progress.json"),
    manifestPath: path.join(MANIFESTS_DIR, `${runId}.json`),
    resultsPath: path.join(rawDir, "orcr_rows.ndjson"),
    comboLogPath: path.join(rawDir, "combo_log.ndjson"),
    failureDir: path.join(rawDir, "failure_snapshots"),
    progress: null,
    resumed: false,
  };
}

function buildManifest(ctx) {
  return {
    run_id: ctx.runId,
    started_at: new Date().toISOString(),
    start_url: START_URL,
    resumed: ctx.resumed,
    config: {
      headless: HEADLESS,
      timeout_ms: PLAYWRIGHT_TIMEOUT_MS,
      throttle_ms: THROTTLE_MS,
      only_round_value: ONLY_ROUND_VALUE,
      only_round_text: ONLY_ROUND_TEXT,
      only_institute_type_value: ONLY_INSTITUTE_TYPE_VALUE,
      only_institute_type_text: ONLY_INSTITUTE_TYPE_TEXT,
      max_rounds: MAX_ROUNDS,
      max_institute_types: MAX_INSTITUTE_TYPES,
      max_institutes: MAX_INSTITUTES,
      max_programs: MAX_PROGRAMS,
      max_combos: MAX_COMBOS,
      seat_mode: SEAT_MODE,
      retry_failed: RETRY_FAILED,
      resume_progress_path: RESUME_PROGRESS_PATH,
    },
    files: {
      raw_dir: ctx.rawDir,
      progress_json: ctx.progressPath,
      combo_log_ndjson: ctx.comboLogPath,
      rows_ndjson: ctx.resultsPath,
      failure_dir: ctx.failureDir,
    },
  };
}

function initialProgress(ctx) {
  return {
    run_id: ctx.runId,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "running",
    combos_completed: 0,
    combos_success: 0,
    combos_no_rows: 0,
    combos_failed: 0,
    rows_total: 0,
    last_combo_key: "",
    last_cursor: {},
    notes: [
      "Default seat mode uses ALL option when present to reduce duplicate extraction.",
      "Fast resume starts near last_cursor instead of replaying the full tree silently.",
    ],
  };
}

function loadCompletedMap(comboLogPath) {
  const map = new Map();
  for (const row of readNdjson(comboLogPath)) {
    if (!row || !row.combo_key) continue;
    map.set(row.combo_key, row.status || "unknown");
  }
  return map;
}

function shouldSkipCombo(completedMap, comboKey) {
  if (!completedMap.has(comboKey)) return false;
  const status = completedMap.get(comboKey);
  if (status === "failed") return !RETRY_FAILED;
  return true;
}

function sameText(a, b) {
  return norm(a) === norm(b);
}

function sliceOptionsFromText(options, targetText) {
  if (!clean(targetText)) return options.slice();
  const idx = options.findIndex((o) => sameText(o.text, targetText));
  if (idx === -1) return options.slice();
  return options.slice(idx);
}

function buildResumeCursor(progress) {
  const last = progress?.last_cursor || {};
  const lastComboKey = clean(progress?.last_combo_key);

  if (!lastComboKey) {
    return {
      active: false,
      announced: false,
      last_combo_key: "",
      round_text: "",
      institute_type_text: "",
      institute_text: "",
      program_text: "",
      seat_type_text: "",
    };
  }

  return {
    active: true,
    announced: false,
    last_combo_key: lastComboKey,
    round_text: clean(last.round_text),
    institute_type_text: clean(last.institute_type_text),
    institute_text: clean(last.institute_text),
    program_text: clean(last.program_text),
    seat_type_text: clean(last.seat_type_text),
  };
}

async function waitStable(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
}

async function waitForRequiredSelectCount(page, minCount = 4, timeoutMs = PLAYWRIGHT_TIMEOUT_MS) {
  await page
    .waitForFunction(
      (minCountInner) => document.querySelectorAll("select").length >= minCountInner,
      minCount,
      { timeout: timeoutMs }
    )
    .catch(() => null);
}

async function gotoBase(page) {
  await page.goto(START_URL, {
    waitUntil: "domcontentloaded",
    timeout: PLAYWRIGHT_TIMEOUT_MS,
  });
  await waitStable(page);
  await waitForRequiredSelectCount(page, 4);
}

async function snapshotSelects(page) {
  return await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();

    return Array.from(document.querySelectorAll("select")).map((select, idx) => ({
      index: idx,
      id: select.id || "",
      name: select.name || "",
      class: clean(select.className || ""),
      selectedValue: clean(select.value),
      selectedText: clean(
        select.options[select.selectedIndex]
          ? select.options[select.selectedIndex].textContent
          : ""
      ),
      optionCount: select.options.length,
      visible: !!(select.offsetWidth || select.offsetHeight || select.getClientRects().length),
      options: Array.from(select.options).map((opt) => ({
        value: clean(opt.value),
        text: clean(opt.textContent),
      })),
    }));
  });
}

function findSelectId(selects, tokenList) {
  const normalized = selects.map((s) => ({
    ...s,
    haystack: norm(`${s.id} ${s.name} ${s.class}`),
  }));

  for (const token of tokenList) {
    const found = normalized.find((s) => s.haystack.includes(norm(token)));
    if (found) return found.id;
  }

  return "";
}

function getSelectById(selects, id) {
  return selects.find((s) => s.id === id) || null;
}

function usableOptions(selectMeta) {
  if (!selectMeta) return [];
  return (selectMeta.options || []).filter((o) => {
    const value = clean(o.value);
    const text = clean(o.text);
    if (!value && !text) return false;
    if (/^select$/i.test(text)) return false;
    if (/^--\s*select\s*--$/i.test(text)) return false;
    return true;
  });
}

function findAllOption(selectMeta) {
  const opts = usableOptions(selectMeta);
  return (
    opts.find((o) => norm(o.text) === "all") ||
    opts.find((o) => norm(o.text) === "--all--") ||
    opts.find((o) => norm(o.value) === "all")
  );
}

function filterOptions(options, onlyValue, onlyText, maxCount) {
  let out = options.slice();

  if (onlyValue) {
    out = out.filter((o) => clean(o.value) === onlyValue);
  }

  if (onlyText) {
    out = out.filter((o) => norm(o.text) === norm(onlyText));
  }

  if (maxCount != null) {
    out = out.slice(0, maxCount);
  }

  return out;
}

async function resolveIds(page) {
  const selects = await snapshotSelects(page);

  const ids = {
    round: findSelectId(selects, ["ddlroundno", "roundno", "round"]),
    instituteType: findSelectId(selects, ["ddlinstype", "instype", "institute type"]),
    institute: findSelectId(selects, ["ddlinstitute", "institute"]),
    program: findSelectId(selects, ["ddlbranch", "branch", "program"]),
    seatType: findSelectId(selects, ["ddlseattype", "seattype", "seat type"]),
  };

  return { ids, selects };
}

async function resolveIdsStrict(page) {
  const { ids, selects } = await resolveIds(page);

  for (const [key, value] of Object.entries(ids)) {
    if (!value) {
      throw new Error(
        `Could not resolve select id for ${key}. Current selects: ${JSON.stringify(
          selects.map((s) => ({
            id: s.id,
            name: s.name,
            optionCount: s.optionCount,
            selectedText: s.selectedText,
          }))
        )}`
      );
    }
  }

  return { ids, selects };
}

async function setSelectValueAndWait(page, selectId, optionValue, requiredAfterSelectCount = 4) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await page.waitForFunction(
        (selectIdInner) => !!document.getElementById(selectIdInner),
        selectId,
        { timeout: 5000 }
      );

      const navPromise = page
        .waitForNavigation({
          waitUntil: "domcontentloaded",
          timeout: 10000,
        })
        .catch(() => null);

      await page.evaluate(
        ({ selectIdInner, optionValueInner }) => {
          const sel = document.getElementById(selectIdInner);
          if (!sel) throw new Error(`Select not found: ${selectIdInner}`);

          const normalize = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
          const opt = Array.from(sel.options).find(
            (o) => normalize(o.value) === normalize(optionValueInner)
          );

          if (!opt) {
            const available = Array.from(sel.options).map((o) => ({
              value: normalize(o.value),
              text: normalize(o.textContent),
            }));
            throw new Error(
              `Option "${optionValueInner}" not found in ${selectIdInner}. Available: ${JSON.stringify(
                available.slice(0, 25)
              )}`
            );
          }

          sel.value = opt.value;
          opt.selected = true;
          sel.dispatchEvent(new Event("input", { bubbles: true }));
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        },
        { selectIdInner: selectId, optionValueInner: optionValue }
      );

      await navPromise;
      await waitStable(page);
      await waitForRequiredSelectCount(page, requiredAfterSelectCount);

      await page
        .waitForFunction(
          ({ selectIdInner, optionValueInner }) => {
            const normalize = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
            const sel = document.getElementById(selectIdInner);
            if (!sel) return false;
            return normalize(sel.value) === normalize(optionValueInner);
          },
          { selectIdInner: selectId, optionValueInner: optionValue },
          { timeout: 5000 }
        )
        .catch(() => null);

      return;
    } catch (err) {
      lastError = err;
      await page.waitForTimeout(1000);
      await waitStable(page);
    }
  }

  throw lastError || new Error(`Failed selecting ${selectId}=${optionValue}`);
}

async function clickSubmitAndWait(page) {
  const navPromise = page
    .waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 10000,
    })
    .catch(() => null);

  const clicked = await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim().toLowerCase();
    const controls = Array.from(
      document.querySelectorAll('button, input[type="button"], input[type="submit"], a')
    );

    let target = null;
    for (const el of controls) {
      const blob = [
        el.textContent || "",
        el.value || "",
        el.getAttribute("title") || "",
        el.getAttribute("name") || "",
        el.id || "",
      ]
        .map(clean)
        .join(" ");

      if (blob.includes("submit")) {
        target = el;
        break;
      }
    }

    if (!target) return { clicked: false, reason: "Submit control not found." };

    target.click();

    return {
      clicked: true,
      tag: target.tagName.toLowerCase(),
      id: target.id || "",
      text: clean(target.textContent || target.value || ""),
    };
  });

  await navPromise;
  await waitStable(page);

  return clicked;
}

async function capturePageState(page) {
  return await page.evaluate(() => {
    const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();

    const bodyText = clean(document.body.innerText || "").slice(0, 6000);

    const tables = Array.from(document.querySelectorAll("table")).map((table, idx) => {
      const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
        Array.from(tr.querySelectorAll("th,td")).map((cell) => clean(cell.textContent))
      );

      const visible =
        !!(table.offsetWidth || table.offsetHeight || table.getClientRects().length);

      return {
        index: idx,
        id: table.id || "",
        class: clean(table.className || ""),
        visible,
        rowCount: rows.length,
        columnCount: rows.length ? Math.max(...rows.map((r) => r.length)) : 0,
        rows,
      };
    });

    return { bodyText, tables };
  });
}

function scoreTable(table) {
  const rows = table.rows || [];
  const joined = rows.flat().join(" ").toLowerCase();
  const headerBlob = (rows[0] || []).join(" ").toLowerCase();

  let score = 0;
  if (table.visible) score += 20;
  if (joined.includes("opening rank")) score += 80;
  if (joined.includes("closing rank")) score += 80;
  if (joined.includes("seat type")) score += 40;
  if (joined.includes("academic program")) score += 35;
  if (joined.includes("institute")) score += 30;
  if (joined.includes("gender")) score += 20;
  if (joined.includes("quota")) score += 20;
  if (headerBlob.includes("opening rank")) score += 50;
  if (headerBlob.includes("closing rank")) score += 50;
  if ((table.rowCount || 0) > 1) score += 10;
  return score;
}

function pickBestResultTable(pageState) {
  const tables = (pageState.tables || [])
    .map((t) => ({ ...t, score: scoreTable(t) }))
    .sort((a, b) => b.score - a.score || (b.rowCount || 0) - (a.rowCount || 0));

  return tables[0] || null;
}

function normalizeHeader(text, idx) {
  const s = clean(text)
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || `col_${idx + 1}`;
}

function tableToObjects(table) {
  if (!table || !Array.isArray(table.rows) || table.rows.length < 2) return [];

  const headerRow = table.rows.find((r) => r.filter((x) => clean(x)).length >= 2);
  if (!headerRow) return [];

  const headerIndex = table.rows.indexOf(headerRow);
  const headers = headerRow.map((h, idx) => normalizeHeader(h, idx));

  const out = [];
  for (let i = headerIndex + 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    if (!row.some((x) => clean(x))) continue;

    const rowBlob = row.join(" ").toLowerCase();
    if (row.length === 1 && (rowBlob.includes("no records") || rowBlob.includes("no data"))) {
      continue;
    }

    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = clean(row[idx] || "");
    });
    out.push(obj);
  }

  return out;
}

async function saveFailureSnapshot(page, ctx, comboKey, stage, errorText) {
  if (!SNAPSHOT_ON_FAILURE) return;

  ensureDir(ctx.failureDir);

  const prefix = `${safeName(comboKey)}__${safeName(stage)}`;
  const htmlPath = path.join(ctx.failureDir, `${prefix}.html`);
  const txtPath = path.join(ctx.failureDir, `${prefix}.txt`);
  const pngPath = path.join(ctx.failureDir, `${prefix}.png`);

  try {
    const html = await page.content();
    const bodyText = await page.evaluate(() => document.body.innerText || "");
    writeText(htmlPath, html);
    writeText(txtPath, `${errorText}\n\n${bodyText}`);
    await page.screenshot({ path: pngPath, fullPage: true });
  } catch {}
}

async function saveSelectSnapshot(page, ctx, fileName) {
  try {
    const selects = await snapshotSelects(page);
    writeJson(path.join(ctx.rawDir, fileName), selects);
  } catch {}
}

async function buildSelectionPath(page, roundOpt, instTypeOpt, instituteOpt, programOpt) {
  await gotoBase(page);

  let resolved = await resolveIdsStrict(page);
  await setSelectValueAndWait(page, resolved.ids.round, roundOpt.value, 4);

  resolved = await resolveIdsStrict(page);
  await setSelectValueAndWait(page, resolved.ids.instituteType, instTypeOpt.value, 4);

  resolved = await resolveIdsStrict(page);
  await setSelectValueAndWait(page, resolved.ids.institute, instituteOpt.value, 4);

  resolved = await resolveIdsStrict(page);
  await setSelectValueAndWait(page, resolved.ids.program, programOpt.value, 4);

  return await resolveIdsStrict(page);
}

function makeComboKey(parts) {
  return [
    parts.roundValue,
    parts.instituteTypeValue,
    parts.instituteValue,
    parts.programValue,
    parts.seatTypeValue,
  ]
    .map(clean)
    .join("||");
}

async function main() {
  const ctx = createRunContext();
  ensureDir(ctx.rawDir);
  ensureDir(ctx.failureDir);
  ensureDir(MANIFESTS_DIR);

  const manifest = buildManifest(ctx);
  writeJson(ctx.manifestPath, manifest);

  const progress = ctx.progress || initialProgress(ctx);
  const completedMap = loadCompletedMap(ctx.comboLogPath);
  const resumeCursor = buildResumeCursor(progress);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    await gotoBase(page);
    const initialResolved = await resolveIdsStrict(page);

    writeJson(path.join(ctx.rawDir, "resolved_select_ids.json"), initialResolved.ids);
    writeJson(path.join(ctx.rawDir, "initial_select_snapshot.json"), initialResolved.selects);

    const roundMeta = getSelectById(initialResolved.selects, initialResolved.ids.round);
    let roundOptions = filterOptions(
      usableOptions(roundMeta),
      ONLY_ROUND_VALUE,
      ONLY_ROUND_TEXT,
      MAX_ROUNDS
    );

    if (resumeCursor.active) {
      roundOptions = sliceOptionsFromText(roundOptions, resumeCursor.round_text);
    }

    console.log("Resolved round select      :", initialResolved.ids.round);
    console.log("Resolved institute type    :", initialResolved.ids.instituteType);
    console.log("Resolved institute name    :", initialResolved.ids.institute);
    console.log("Resolved program           :", initialResolved.ids.program);
    console.log("Resolved seat type         :", initialResolved.ids.seatType);
    console.log("Rounds to process          :", roundOptions.length);

    if (resumeCursor.active) {
      console.log(
        "Fast resume target         :",
        JSON.stringify({
          last_combo_key: resumeCursor.last_combo_key,
          round_text: resumeCursor.round_text,
          institute_type_text: resumeCursor.institute_type_text,
          institute_text: resumeCursor.institute_text,
          program_text: resumeCursor.program_text,
          seat_type_text: resumeCursor.seat_type_text,
        })
      );
    }

    let combosProcessedThisRun = 0;

    for (const roundOpt of roundOptions) {
      await gotoBase(page);
      let resolved = await resolveIdsStrict(page);
      await setSelectValueAndWait(page, resolved.ids.round, roundOpt.value, 4);

      resolved = await resolveIdsStrict(page);
      const instTypeMeta = getSelectById(resolved.selects, resolved.ids.instituteType);
      let instTypeOptions = filterOptions(
        usableOptions(instTypeMeta),
        ONLY_INSTITUTE_TYPE_VALUE,
        ONLY_INSTITUTE_TYPE_TEXT,
        MAX_INSTITUTE_TYPES
      );

      if (resumeCursor.active && sameText(roundOpt.text, resumeCursor.round_text)) {
        instTypeOptions = sliceOptionsFromText(instTypeOptions, resumeCursor.institute_type_text);
      }

      console.log(`Round ${roundOpt.text} -> institute types: ${instTypeOptions.length}`);

      for (const instTypeOpt of instTypeOptions) {
        await gotoBase(page);
        resolved = await resolveIdsStrict(page);
        await setSelectValueAndWait(page, resolved.ids.round, roundOpt.value, 4);

        resolved = await resolveIdsStrict(page);
        await setSelectValueAndWait(page, resolved.ids.instituteType, instTypeOpt.value, 4);

        resolved = await resolveIdsStrict(page);
        const instituteMeta = getSelectById(resolved.selects, resolved.ids.institute);

        let instituteOptions = usableOptions(instituteMeta);
        if (
          resumeCursor.active &&
          sameText(roundOpt.text, resumeCursor.round_text) &&
          sameText(instTypeOpt.text, resumeCursor.institute_type_text)
        ) {
          instituteOptions = sliceOptionsFromText(instituteOptions, resumeCursor.institute_text);
        }
        instituteOptions = instituteOptions.slice(0, MAX_INSTITUTES ?? undefined);

        console.log(
          `Round ${roundOpt.text} | Institute Type ${instTypeOpt.text} -> institutes: ${instituteOptions.length}`
        );

        for (const instituteOpt of instituteOptions) {
          await gotoBase(page);
          resolved = await resolveIdsStrict(page);
          await setSelectValueAndWait(page, resolved.ids.round, roundOpt.value, 4);

          resolved = await resolveIdsStrict(page);
          await setSelectValueAndWait(page, resolved.ids.instituteType, instTypeOpt.value, 4);

          resolved = await resolveIdsStrict(page);
          await setSelectValueAndWait(page, resolved.ids.institute, instituteOpt.value, 4);

          resolved = await resolveIdsStrict(page);
          const programMeta = getSelectById(resolved.selects, resolved.ids.program);

          let programOptions = usableOptions(programMeta);
          if (
            resumeCursor.active &&
            sameText(roundOpt.text, resumeCursor.round_text) &&
            sameText(instTypeOpt.text, resumeCursor.institute_type_text) &&
            sameText(instituteOpt.text, resumeCursor.institute_text)
          ) {
            programOptions = sliceOptionsFromText(programOptions, resumeCursor.program_text);
          }
          programOptions = programOptions.slice(0, MAX_PROGRAMS ?? undefined);

          console.log(
            `Round ${roundOpt.text} | ${instTypeOpt.text} | ${instituteOpt.text} -> programs: ${programOptions.length}`
          );

          for (const programOpt of programOptions) {
            if (MAX_COMBOS != null && combosProcessedThisRun >= MAX_COMBOS) {
              progress.status = "stopped_by_max_combos";
              progress.updated_at = new Date().toISOString();
              writeJson(ctx.progressPath, progress);
              console.log(`Stopped because MAX_COMBOS=${MAX_COMBOS} reached.`);
              return;
            }

            let finalResolved = null;
            try {
              finalResolved = await buildSelectionPath(
                page,
                roundOpt,
                instTypeOpt,
                instituteOpt,
                programOpt
              );
            } catch (err) {
              const comboKeyBase = makeComboKey({
                roundValue: roundOpt.value,
                instituteTypeValue: instTypeOpt.value,
                instituteValue: instituteOpt.value,
                programValue: programOpt.value,
                seatTypeValue: "__path__",
              });

              await saveSelectSnapshot(
                page,
                ctx,
                `selects_before_path_failure_${safeName(comboKeyBase)}.json`
              );
              await saveFailureSnapshot(
                page,
                ctx,
                comboKeyBase,
                "path_build_failure",
                String(err)
              );

              appendNdjson(ctx.comboLogPath, {
                combo_key: comboKeyBase,
                round_value: roundOpt.value,
                round_text: roundOpt.text,
                institute_type_value: instTypeOpt.value,
                institute_type_text: instTypeOpt.text,
                institute_value: instituteOpt.value,
                institute_text: instituteOpt.text,
                program_value: programOpt.value,
                program_text: programOpt.text,
                seat_type_value: "__path__",
                seat_type_text: "__path__",
                extracted_at: new Date().toISOString(),
                status: "failed",
                error: `Path build failure: ${String(err)}`,
              });

              progress.combos_completed += 1;
              progress.combos_failed += 1;
              progress.updated_at = new Date().toISOString();
              writeJson(ctx.progressPath, progress);

              combosProcessedThisRun += 1;
              continue;
            }

            const seatMeta = getSelectById(finalResolved.selects, finalResolved.ids.seatType);

            let seatChoices = [];
            const allOption = findAllOption(seatMeta);

            if (SEAT_MODE === "all_option" && allOption) {
              seatChoices = [allOption];
            } else {
              seatChoices = usableOptions(seatMeta);
            }

            for (const seatOpt of seatChoices) {
              const comboKey = makeComboKey({
                roundValue: roundOpt.value,
                instituteTypeValue: instTypeOpt.value,
                instituteValue: instituteOpt.value,
                programValue: programOpt.value,
                seatTypeValue: seatOpt.value,
              });

              if (comboKey === resumeCursor.last_combo_key) {
                continue;
              }

              if (shouldSkipCombo(completedMap, comboKey)) {
                continue;
              }

              if (resumeCursor.active && !resumeCursor.announced) {
                console.log(`Fast resume reached first new combo after ${resumeCursor.last_combo_key}`);
                resumeCursor.announced = true;
                resumeCursor.active = false;
              }

              const comboMeta = {
                combo_key: comboKey,
                round_value: roundOpt.value,
                round_text: roundOpt.text,
                institute_type_value: instTypeOpt.value,
                institute_type_text: instTypeOpt.text,
                institute_value: instituteOpt.value,
                institute_text: instituteOpt.text,
                program_value: programOpt.value,
                program_text: programOpt.text,
                seat_type_value: seatOpt.value,
                seat_type_text: seatOpt.text,
                extracted_at: new Date().toISOString(),
              };

              try {
                await setSelectValueAndWait(page, finalResolved.ids.seatType, seatOpt.value, 4);

                const submitInfo = await clickSubmitAndWait(page);
                const pageState = await capturePageState(page);
                const bestTable = pickBestResultTable(pageState);
                const rows = tableToObjects(bestTable).map((row, idx) => ({
                  ...comboMeta,
                  row_index: idx,
                  ...row,
                }));

                for (const row of rows) {
                  appendNdjson(ctx.resultsPath, row);
                }

                const status = rows.length > 0 ? "success" : "no_rows";

                appendNdjson(ctx.comboLogPath, {
                  ...comboMeta,
                  status,
                  row_count: rows.length,
                  submit_info: submitInfo,
                  best_table: bestTable
                    ? {
                        id: bestTable.id,
                        class: bestTable.class,
                        row_count: bestTable.rowCount,
                        column_count: bestTable.columnCount,
                        score: bestTable.score,
                      }
                    : null,
                  body_text_preview: pageState.bodyText.slice(0, 1000),
                });

                completedMap.set(comboKey, status);

                progress.combos_completed += 1;
                if (status === "success") progress.combos_success += 1;
                if (status === "no_rows") progress.combos_no_rows += 1;
                progress.rows_total += rows.length;
                progress.last_combo_key = comboKey;
                progress.last_cursor = {
                  round_text: roundOpt.text,
                  institute_type_text: instTypeOpt.text,
                  institute_text: instituteOpt.text,
                  program_text: programOpt.text,
                  seat_type_text: seatOpt.text,
                };
                progress.updated_at = new Date().toISOString();
                writeJson(ctx.progressPath, progress);

                combosProcessedThisRun += 1;

                console.log(
                  `[${progress.combos_completed}] ${roundOpt.text} | ${instTypeOpt.text} | ${instituteOpt.text} | ${programOpt.text} | ${seatOpt.text} -> ${status} rows=${rows.length}`
                );
              } catch (err) {
                const errorText = String(err);
                await saveSelectSnapshot(
                  page,
                  ctx,
                  `selects_before_combo_failure_${safeName(comboKey)}.json`
                );
                await saveFailureSnapshot(page, ctx, comboKey, "combo_failure", errorText);

                appendNdjson(ctx.comboLogPath, {
                  ...comboMeta,
                  status: "failed",
                  error: errorText,
                });

                completedMap.set(comboKey, "failed");

                progress.combos_completed += 1;
                progress.combos_failed += 1;
                progress.last_combo_key = comboKey;
                progress.last_cursor = {
                  round_text: roundOpt.text,
                  institute_type_text: instTypeOpt.text,
                  institute_text: instituteOpt.text,
                  program_text: programOpt.text,
                  seat_type_text: seatOpt.text,
                };
                progress.updated_at = new Date().toISOString();
                writeJson(ctx.progressPath, progress);

                combosProcessedThisRun += 1;

                console.log(
                  `[${progress.combos_completed}] ${roundOpt.text} | ${instTypeOpt.text} | ${instituteOpt.text} | ${programOpt.text} | ${seatOpt.text} -> FAILED`
                );

                await gotoBase(page);
              }

              if (THROTTLE_MS > 0) {
                await page.waitForTimeout(THROTTLE_MS);
              }
            }
          }
        }
      }
    }

    progress.status = "completed";
    progress.updated_at = new Date().toISOString();
    writeJson(ctx.progressPath, progress);

    console.log("\nJOSAA FULL ORCR EXTRACTION COMPLETE");
    console.log("Run ID                :", ctx.runId);
    console.log("Raw Dir               :", ctx.rawDir);
    console.log("Progress JSON         :", ctx.progressPath);
    console.log("Combo Log NDJSON      :", ctx.comboLogPath);
    console.log("Rows NDJSON           :", ctx.resultsPath);
    console.log("Combos Completed      :", progress.combos_completed);
    console.log("Success               :", progress.combos_success);
    console.log("No Rows               :", progress.combos_no_rows);
    console.log("Failed                :", progress.combos_failed);
    console.log("Rows Total            :", progress.rows_total);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("JOSAA FULL ORCR EXTRACTION FAILED");
  console.error(err);
  process.exit(1);
});