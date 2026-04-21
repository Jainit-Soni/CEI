#!/usr/bin/env node

/**
 * JoSAA OR-CR extractor for CEI
 *
 * What it does:
 * - Drives the official JoSAA ASP.NET OR-CR form with Playwright
 * - Enumerates Round -> Institute Type -> Institute -> Program -> Seat Type
 * - Extracts table rows for every valid combination
 * - Writes CEI-ready NDJSON + progress checkpoint for resume
 *
 * Usage:
 *   node josaa_playwright_extractor.js
 *   node josaa_playwright_extractor.js --headful
 *   node josaa_playwright_extractor.js --rounds=1,2,3,4,5,6
 *   node josaa_playwright_extractor.js --limit-combos=100
 *   node josaa_playwright_extractor.js --resume=./output/progress.json
 *   node josaa_playwright_extractor.js --out=./output/josaa_orcr.ndjson
 *
 * Install:
 *   npm i playwright fs-extra minimist
 *   npx playwright install chromium
 */

const fs = require('fs-extra');
const path = require('path');
const minimist = require('minimist');
const { chromium } = require('playwright');

const argv = minimist(process.argv.slice(2), {
  boolean: ['headful', 'debug'],
  string: ['out', 'resume', 'rounds'],
  default: {
    headful: false,
    debug: false,
    out: path.resolve(process.cwd(), 'output', `josaa_orcr_${timestampSafe()}.ndjson`),
  },
});

const TARGET_URL = 'https://josaa.admissions.nic.in/applicant/SeatAllotmentResult/CurrentORCR.aspx';
const OUTPUT_PATH = path.resolve(argv.out);
const OUTPUT_DIR = path.dirname(OUTPUT_PATH);
const PROGRESS_PATH = path.resolve(
  argv.resume || path.join(OUTPUT_DIR, 'progress.json')
);
const META_PATH = path.join(OUTPUT_DIR, 'run_meta.json');

const SELECTORS = {
  round: [
    '#ctl00_ContentPlaceHolder1_ddlroundno',
    'select:near(:text("Round No"))',
  ],
  instituteType: [
    '#ctl00_ContentPlaceHolder1_ddlInstype',
    'select:near(:text("Institute Type"))',
  ],
  instituteName: [
    '#ctl00_ContentPlaceHolder1_ddlInstitute',
    'select:near(:text("Institute Name"))',
  ],
  program: [
    '#ctl00_ContentPlaceHolder1_ddlBranch',
    'select:near(:text("Academic Program"))',
  ],
  seatType: [
    '#ctl00_ContentPlaceHolder1_ddlSeattype',
    'select:near(:text("Seat Type / Category"))',
  ],
  submit: [
    '#ctl00_ContentPlaceHolder1_btnSubmit',
    'input[type="submit"]',
    'button:has-text("Submit")',
  ],
  resultTable: [
    '#ctl00_ContentPlaceHolder1_GridView1',
    'table:has(th:text("Opening Rank"))',
    'table:has-text("Opening Rank")',
  ],
  noDataMarkers: [
    'text=No data found',
    'text=No records found',
    'text=No Record Found',
    'text=No data available',
  ],
};

const WAIT = {
  short: 300,
  medium: 700,
  long: 1500,
  timeout: 30000,
};

async function main() {
  await fs.ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({
    headless: !argv.headful,
    slowMo: argv.debug ? 200 : 0,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(WAIT.timeout);

  const meta = {
    startedAt: new Date().toISOString(),
    targetUrl: TARGET_URL,
    outputPath: OUTPUT_PATH,
    progressPath: PROGRESS_PATH,
    args: argv,
  };
  await fs.writeJson(META_PATH, meta, { spaces: 2 });

  try {
    await openTarget(page);
    const resolved = await resolveAllSelectors(page);
    log('Resolved selectors', resolved);

    const rounds = await getOptions(page, resolved.round);
    const requestedRounds = parseRequestedRounds(argv.rounds);
    const finalRounds = requestedRounds.length
      ? rounds.filter((r) => requestedRounds.includes(r.text))
      : rounds;

    log(
      'Rounds to process',
      finalRounds.map((r) => r.text)
    );

    const progress = (await loadProgress()) || {};
    const resumeKey = progress.last_combo_key || null;
    if (resumeKey) {
      log('Fast resume target', progress);
    }

    let totalCombos = 0;
    let totalRows = progress.total_rows || 0;
    let totalWritten = progress.total_written || 0;
    let resumePassed = !resumeKey;
    const comboLimit = Number(argv['limit-combos'] || 0) || null;

    for (const round of finalRounds) {
      await safeSelect(page, resolved.round, round.value, 'round');
      await refreshAfterSelect(page);

      const instituteTypes = await getOptions(page, resolved.instituteType);
      for (const instituteType of instituteTypes) {
        await safeSelect(page, resolved.instituteType, instituteType.value, 'instituteType');
        await refreshAfterSelect(page);

        const institutes = await getOptions(page, resolved.instituteName);
        for (const institute of institutes) {
          await safeSelect(page, resolved.instituteName, institute.value, 'instituteName');
          await refreshAfterSelect(page);

          const programs = await getOptions(page, resolved.program);
          for (const program of programs) {
            await safeSelect(page, resolved.program, program.value, 'program');
            await refreshAfterSelect(page);

            const seatTypes = await getOptions(page, resolved.seatType);
            for (const seatType of seatTypes) {
              const combo = {
                round_text: round.text,
                round_value: round.value,
                institute_type_text: instituteType.text,
                institute_type_value: instituteType.value,
                institute_text: institute.text,
                institute_value: institute.value,
                program_text: program.text,
                program_value: program.value,
                seat_type_text: seatType.text,
                seat_type_value: seatType.value,
              };

              const comboKey = makeComboKey(combo);

              if (!resumePassed) {
                if (comboKey === resumeKey) {
                  resumePassed = true;
                }
                continue;
              }

              totalCombos += 1;
              if (comboLimit && totalCombos > comboLimit) {
                log('Stopped by --limit-combos', comboLimit);
                await saveProgress({
                  ...combo,
                  last_combo_key: comboKey,
                  total_rows: totalRows,
                  total_written: totalWritten,
                  stoppedBecause: 'limit-combos',
                  savedAt: new Date().toISOString(),
                });
                await browser.close();
                return;
              }

              await safeSelect(page, resolved.seatType, seatType.value, 'seatType');
              await settleForm(page);

              const rows = await submitAndExtract(page, resolved, combo);
              totalRows += rows.length;

              if (rows.length > 0) {
                await appendNdjson(OUTPUT_PATH, rows);
                totalWritten += rows.length;
              }

              await saveProgress({
                ...combo,
                last_combo_key: comboKey,
                total_rows: totalRows,
                total_written: totalWritten,
                savedAt: new Date().toISOString(),
              });

              log(
                `Combo ${totalCombos}`,
                `${combo.round_text} | ${combo.institute_type_text} | ${combo.institute_text} | ${combo.program_text} | ${combo.seat_type_text} => ${rows.length} rows`
              );
            }
          }
        }
      }
    }

    await saveProgress({
      status: 'completed',
      total_rows: totalRows,
      total_written: totalWritten,
      completedAt: new Date().toISOString(),
    });

    log('Completed', {
      totalCombos,
      totalRows,
      totalWritten,
      output: OUTPUT_PATH,
      progress: PROGRESS_PATH,
    });
  } catch (error) {
    log('Fatal error', error.stack || String(error));
    await saveProgress({
      status: 'failed',
      error: error.stack || String(error),
      failedAt: new Date().toISOString(),
    });
    throw error;
  } finally {
    await browser.close();
  }
}

async function openTarget(page) {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(WAIT.medium);
}

async function resolveAllSelectors(page) {
  return {
    round: await resolveSelector(page, SELECTORS.round),
    instituteType: await resolveSelector(page, SELECTORS.instituteType),
    instituteName: await resolveSelector(page, SELECTORS.instituteName),
    program: await resolveSelector(page, SELECTORS.program),
    seatType: await resolveSelector(page, SELECTORS.seatType),
    submit: await resolveSelector(page, SELECTORS.submit),
  };
}

async function resolveSelector(page, candidates) {
  for (const candidate of candidates) {
    const loc = page.locator(candidate).first();
    if ((await loc.count()) > 0) {
      return candidate;
    }
  }
  throw new Error(`Could not resolve selector from candidates: ${candidates.join(', ')}`);
}

async function getOptions(page, selector) {
  const raw = await page.locator(selector).evaluate((el) => {
    return Array.from(el.options).map((o) => ({
      value: o.value,
      text: (o.textContent || '').trim(),
      disabled: o.disabled,
    }));
  });

  return raw.filter((o) => {
    const txt = normalizeSpace(o.text).toLowerCase();
    if (!o.value) return false;
    if (o.disabled) return false;
    if (!txt) return false;
    if (txt.includes('select')) return false;
    if (txt.includes('required')) return false;
    return true;
  });
}

async function safeSelect(page, selector, value, label) {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'attached' });

  await waitUntilSelectUsable(page, selector, label);

  const options = await getOptions(page, selector);
  const exists = options.some((o) => o.value === value);
  if (!exists) {
    throw new Error(`Option not found for ${label}: ${value}`);
  }

  // JoSAA skins the native <select> with a custom UI, so the real <select>
  // stays hidden. Waiting for visibility is wrong here. Playwright can still
  // select on the real control as long as it is attached and enabled.
  await loc.selectOption(value, { timeout: WAIT.timeout });

  await page.waitForTimeout(WAIT.short);
}

async function waitUntilSelectUsable(page, selector, label) {
  const start = Date.now();

  while (Date.now() - start < WAIT.timeout) {
    const state = await page.locator(selector).first().evaluate((el) => ({
      disabled: !!el.disabled,
      optionCount: el.options ? el.options.length : 0,
      value: el.value,
    })).catch(() => null);

    if (state && !state.disabled && state.optionCount > 0) {
      return;
    }

    await page.waitForTimeout(200);
  }

  throw new Error(`Select not usable for ${label} within timeout`);
}

async function refreshAfterSelect(page) {
  await settleForm(page);
}

async function settleForm(page) {
  await page.waitForTimeout(WAIT.medium);
  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(WAIT.short);
}

async function submitAndExtract(page, resolved, combo) {
  const button = page.locator(resolved.submit).first();
  await button.waitFor({ state: 'visible' });

  await Promise.allSettled([
    page.waitForLoadState('domcontentloaded'),
    page.waitForLoadState('networkidle', { timeout: 8000 }),
    button.click(),
  ]);
  await page.waitForTimeout(WAIT.medium);

  const noData = await detectNoData(page);
  if (noData) {
    return [];
  }

  const tableSelector = await resolveExistingResultTable(page);
  if (!tableSelector) {
    return [];
  }

  const headers = await page.locator(tableSelector).locator('tr').first().locator('th,td').evaluateAll((cells) =>
    cells.map((c) => (c.textContent || '').trim())
  );

  const rows = await page.locator(tableSelector).locator('tr').evaluateAll((trs, { combo, headers }) => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const out = [];

    for (let i = 1; i < trs.length; i += 1) {
      const cells = Array.from(trs[i].querySelectorAll('td')).map((td) => clean(td.textContent));
      if (!cells.length) continue;

      const rec = {
        source: 'josaa_orcr',
        source_url: window.location.href,
        extracted_at: new Date().toISOString(),
        round: combo.round_text,
        institute_type: combo.institute_type_text,
        institute_name: combo.institute_text,
        academic_program: combo.program_text,
        seat_type_category: combo.seat_type_text,
        raw_headers: headers,
        raw_cells: cells,
      };

      for (let j = 0; j < headers.length; j += 1) {
        const key = clean(headers[j])
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        if (key) {
          rec[key] = cells[j] ?? null;
        }
      }

      out.push(rec);
    }

    return out;
  }, { combo, headers });

  return rows.map(normalizeRow);
}

async function resolveExistingResultTable(page) {
  for (const candidate of SELECTORS.resultTable) {
    const loc = page.locator(candidate).first();
    if ((await loc.count()) > 0) {
      const rowCount = await loc.locator('tr').count().catch(() => 0);
      if (rowCount > 1) return candidate;
    }
  }
  return null;
}

async function detectNoData(page) {
  for (const marker of SELECTORS.noDataMarkers) {
    const loc = page.locator(marker).first();
    if ((await loc.count()) > 0) return true;
  }
  return false;
}

function normalizeRow(row) {
  const normalized = { ...row };

  normalized.opening_rank = cleanRankValue(
    row.opening_rank || row.openingrank || row.opening_rank_ || null
  );
  normalized.closing_rank = cleanRankValue(
    row.closing_rank || row.closingrank || row.closing_rank_ || null
  );

  normalized.gender =
    row.gender ||
    row.gender_neutral ||
    row.gender_pool ||
    inferGenderFromCells(row.raw_cells);

  normalized.quota =
    row.quota || inferFieldByHeaderOrPosition(row, ['quota']);

  normalized.seat_pool =
    row.seat_pool ||
    row.pool ||
    inferFieldByHeaderOrPosition(row, ['seat_pool', 'pool']);

  normalized.category = row.seat_type_category;
  normalized.cei_stable_key = makeStableKey(normalized);

  return normalized;
}

function inferGenderFromCells(cells) {
  if (!Array.isArray(cells)) return null;
  for (const cell of cells) {
    const v = String(cell || '').toLowerCase();
    if (v.includes('gender-neutral')) return 'Gender-Neutral';
    if (v.includes('female-only')) return 'Female-only';
  }
  return null;
}

function inferFieldByHeaderOrPosition(row, candidateKeys) {
  for (const key of candidateKeys) {
    if (row[key] != null) return row[key];
  }
  return null;
}

function cleanRankValue(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;

  const preparatory = text.endsWith('P');
  const numericPart = text.replace(/P$/i, '').replace(/,/g, '').trim();
  const number = /^\d+$/.test(numericPart) ? Number(numericPart) : null;

  return {
    raw: text,
    numeric: number,
    preparatory,
  };
}

function makeStableKey(row) {
  return [
    row.round,
    row.institute_type,
    row.institute_name,
    row.academic_program,
    row.seat_type_category,
    row.quota || '',
    row.gender || '',
    row.opening_rank?.raw || '',
    row.closing_rank?.raw || '',
  ].join('||');
}

function makeComboKey(combo) {
  return [
    combo.round_text,
    combo.institute_type_value,
    combo.institute_value,
    combo.program_value,
    combo.seat_type_value,
  ].join('||');
}

async function appendNdjson(filePath, rows) {
  const payload = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await fs.appendFile(filePath, payload, 'utf8');
}

async function loadProgress() {
  if (!(await fs.pathExists(PROGRESS_PATH))) return null;
  return fs.readJson(PROGRESS_PATH);
}

async function saveProgress(data) {
  await fs.writeJson(PROGRESS_PATH, data, { spaces: 2 });
}

function parseRequestedRounds(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function timestampSafe() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function log(label, value) {
  if (typeof value === 'string') {
    console.log(`${label.padEnd(24)}: ${value}`);
    return;
  }
  console.log(`${label.padEnd(24)}: ${JSON.stringify(value, null, 2)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
