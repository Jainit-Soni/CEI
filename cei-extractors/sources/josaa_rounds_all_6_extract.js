#!/usr/bin/env node

/**
 * JoSAA OR-CR extractor: ALL filters, all 6 rounds
 *
 * Goal:
 * - Open the official OR-CR page fresh for each round
 * - Keep Institute Type / Institute Name / Academic Program / Seat Type as ALL
 * - Extract the visible result table for rounds 1..6
 * - Follow table pagination if present
 * - Write NDJSON output for CEI ingestion
 *
 * Install:
 *   npm i playwright fs-extra minimist
 *   npx playwright install chromium
 *
 * Run:
 *   node josaa_rounds_all6_extract.js --headful
 *   node josaa_rounds_all6_extract.js --out=./output/josaa_orcr_all6.ndjson
 */

const path = require('path');
const fs = require('fs-extra');
const minimist = require('minimist');
const { chromium } = require('playwright');

const argv = minimist(process.argv.slice(2), {
  boolean: ['headful', 'debug'],
  string: ['out'],
  default: {
    headful: false,
    debug: false,
    out: path.resolve(process.cwd(), 'output', 'josaa_orcr_all6.ndjson'),
  },
});

const TARGET_URL = 'https://josaa.admissions.nic.in/applicant/SeatAllotmentResult/CurrentORCR.aspx';
const OUTPUT_PATH = path.resolve(argv.out);
const OUTPUT_DIR = path.dirname(OUTPUT_PATH);
const RUN_META_PATH = path.join(OUTPUT_DIR, 'josaa_orcr_all6_run_meta.json');

const SEL = {
  round: '#ctl00_ContentPlaceHolder1_ddlroundno',
  instituteType: '#ctl00_ContentPlaceHolder1_ddlInstype',
  instituteName: '#ctl00_ContentPlaceHolder1_ddlInstitute',
  program: '#ctl00_ContentPlaceHolder1_ddlBranch',
  seatType: '#ctl00_ContentPlaceHolder1_ddlSeattype',
  submit: '#ctl00_ContentPlaceHolder1_btnSubmit',
  table: '#ctl00_ContentPlaceHolder1_GridView1',
  viewState: '#__VIEWSTATE',
};

const WAIT = {
  timeout: 45000,
  short: 250,
  medium: 800,
  long: 1800,
};

async function main() {
  await fs.ensureDir(OUTPUT_DIR);
  await fs.writeFile(OUTPUT_PATH, '', 'utf8');

  const browser = await chromium.launch({
    headless: !argv.headful,
    slowMo: argv.debug ? 250 : 0,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(WAIT.timeout);

  await fs.writeJson(
    RUN_META_PATH,
    {
      targetUrl: TARGET_URL,
      outputPath: OUTPUT_PATH,
      startedAt: new Date().toISOString(),
      args: argv,
    },
    { spaces: 2 }
  );

  try {
    const allRows = [];

    for (const roundText of ['1', '2', '3', '4', '5', '6']) {
      log('ROUND', roundText);

      await openFresh(page);
      await ensureBasePageReady(page);

      await selectRoundViaAspNetPostback(page, roundText);
      await ensureAllFiltersStillAll(page);
      await submitFilters(page);

      const roundRows = await collectAllTablePages(page, roundText);
      log('ROWS', `${roundText} => ${roundRows.length}`);

      if (roundRows.length > 0) {
        await appendNdjson(OUTPUT_PATH, roundRows);
        allRows.push(...roundRows);
      }
    }

    await fs.writeJson(
      RUN_META_PATH,
      {
        targetUrl: TARGET_URL,
        outputPath: OUTPUT_PATH,
        finishedAt: new Date().toISOString(),
        totalRows: allRows.length,
        rounds: ['1', '2', '3', '4', '5', '6'],
        args: argv,
      },
      { spaces: 2 }
    );

    log('DONE', `Wrote ${allRows.length} rows to ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

async function openFresh(page) {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(WAIT.medium);
}

async function ensureBasePageReady(page) {
  // For the all-filters-ALL extractor, only the round selector and submit button
  // must be operational up front. The dependent filters can be visually set to ALL
  // while their hidden native controls remain lazy / skinned / partially initialized.
  await page.locator(SEL.round).waitFor({ state: 'attached' });
  await page.locator(SEL.submit).waitFor({ state: 'visible' });
  await waitUntilSelectHasOptions(page, SEL.round, 'round');
}

async function waitUntilSelectHasOptions(page, selector, label) {
  const started = Date.now();
  while (Date.now() - started < WAIT.timeout) {
    const state = await page.locator(selector).evaluate((el) => ({
      disabled: !!el.disabled,
      count: el.options ? el.options.length : 0,
      values: el.options ? Array.from(el.options).map((o) => o.value) : [],
    })).catch(() => null);

    if (state && !state.disabled && state.count > 0) {
      return;
    }

    await page.waitForTimeout(200);
  }

  throw new Error(`Select never became usable: ${label}`);
}

async function readViewState(page) {
  return page.locator(SEL.viewState).inputValue().catch(() => null);
}

async function waitForViewStateChange(page, previousValue) {
  if (!previousValue) {
    await page.waitForTimeout(WAIT.long);
    await page.waitForLoadState('networkidle').catch(() => null);
    return;
  }

  await page.waitForFunction(
    ({ selector, previousValue }) => {
      const node = document.querySelector(selector);
      return !!node && node.value && node.value !== previousValue;
    },
    { selector: SEL.viewState, previousValue },
    { timeout: WAIT.timeout }
  ).catch(() => null);

  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(WAIT.medium);
}

async function selectRoundViaAspNetPostback(page, roundText) {
  const previousViewState = await readViewState(page);

  const optionValue = await page.locator(SEL.round).evaluate((el, desiredText) => {
    const options = Array.from(el.options).map((o) => ({
      value: o.value,
      text: (o.textContent || '').trim(),
    }));
    const hit = options.find((o) => o.text === desiredText || o.value === desiredText);
    return hit ? hit.value : null;
  }, roundText);

  if (!optionValue) {
    throw new Error(`Round option not found: ${roundText}`);
  }

  try {
    await page.locator(SEL.round).evaluate((el, nextValue) => {
      const option = Array.from(el.options).find((o) => o.value === nextValue);
      if (!option) throw new Error(`Option missing for value ${nextValue}`);

      el.value = nextValue;
      option.selected = true;

      if (typeof window.__doPostBack === 'function') {
        window.__doPostBack(el.name || el.id, '');
      } else if (el.form) {
        el.form.submit();
      }
    }, optionValue);
  } catch (error) {
    const msg = String(error && error.message ? error.message : error);
    if (!msg.includes('Execution context was destroyed')) {
      throw error;
    }
  }

  await waitForViewStateChange(page, previousViewState);

  await page.waitForFunction(
    ({ selector, optionValue }) => {
      const el = document.querySelector(selector);
      return !!el && el.value === optionValue;
    },
    { selector: SEL.round, optionValue },
    { timeout: WAIT.timeout }
  );
}

async function ensureAllFiltersStillAll(page) {
  // After changing round, JoSAA can reset dependent filters back to --Select--.
  // For this extractor we explicitly drive each dependent filter back to ALL.
  const chain = [
    { selector: SEL.instituteType, label: 'Institute Type' },
    { selector: SEL.instituteName, label: 'Institute Name' },
    { selector: SEL.program, label: 'Academic Program' },
    { selector: SEL.seatType, label: 'Seat Type / Category' },
  ];

  for (const item of chain) {
    await forceSelectText(page, item.selector, item.label, 'ALL');
  }
}

async function forceSelectText(page, selector, label, desiredText) {
  await page.locator(selector).waitFor({ state: 'attached' });
  await waitUntilSelectHasOptions(page, selector, label);

  const state = await page.locator(selector).evaluate((el, desired) => {
    const options = Array.from(el.options).map((o) => ({
      value: o.value,
      text: (o.textContent || '').trim(),
      disabled: !!o.disabled,
    }));
    const selected = el.options[el.selectedIndex];
    const currentText = selected ? (selected.textContent || '').trim() : null;
    const target = options.find((o) => o.text.toUpperCase() === String(desired).toUpperCase() && !o.disabled);
    return {
      currentText,
      targetValue: target ? target.value : null,
      availableTexts: options.map((o) => o.text),
    };
  }, desiredText);

  if (String(state.currentText || '').toUpperCase() === String(desiredText).toUpperCase()) {
    return;
  }

  if (!state.targetValue) {
    throw new Error(`${label} could not be set to ${desiredText}. Current: ${state.currentText}. Options: ${state.availableTexts.join(' | ')}`);
  }

  const previousViewState = await readViewState(page);

  try {
    await page.locator(selector).evaluate((el, payload) => {
      const { targetValue } = payload;
      const option = Array.from(el.options).find((o) => o.value === targetValue);
      if (!option) {
        throw new Error(`Target option missing: ${targetValue}`);
      }

      el.value = targetValue;
      option.selected = true;

      if (typeof window.__doPostBack === 'function') {
        window.__doPostBack(el.name || el.id, '');
      } else {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, { targetValue: state.targetValue });
  } catch (error) {
    const msg = String(error && error.message ? error.message : error);
    if (!msg.includes('Execution context was destroyed')) {
      throw error;
    }
  }

  await waitForViewStateChange(page, previousViewState);
  await page.locator(selector).waitFor({ state: 'attached' });
  await waitUntilSelectHasOptions(page, selector, label);

  await page.waitForFunction(
    ({ selector, desiredText }) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const selected = el.options[el.selectedIndex];
      const text = selected ? (selected.textContent || '').trim().toUpperCase() : '';
      return text === String(desiredText).toUpperCase();
    },
    { selector, desiredText },
    { timeout: WAIT.timeout }
  );
}

async function submitFilters(page) {
  const previousViewState = await readViewState(page);

  await Promise.allSettled([
    page.locator(SEL.submit).click({ force: true }),
  ]);

  await waitForViewStateChange(page, previousViewState);
  await page.locator(SEL.table).waitFor({ state: 'attached' });
  await page.waitForFunction(
    (selector) => {
      const table = document.querySelector(selector);
      return !!table && table.querySelectorAll('tr').length > 1;
    },
    SEL.table,
    { timeout: WAIT.timeout }
  );
}

async function collectAllTablePages(page, roundText) {
  const out = [];
  const seenPageFingerprints = new Set();

  let pageNumber = 1;
  while (true) {
    const rows = await extractCurrentTableRows(page, roundText, pageNumber);
    const fingerprint = JSON.stringify({
      pageNumber,
      count: rows.length,
      first: rows[0]?.cei_stable_key || null,
      last: rows[rows.length - 1]?.cei_stable_key || null,
    });

    if (seenPageFingerprints.has(fingerprint)) {
      break;
    }
    seenPageFingerprints.add(fingerprint);

    out.push(...rows);

    const moved = await gotoNextTablePage(page);
    if (!moved) {
      break;
    }

    pageNumber += 1;
  }

  return out;
}

async function extractCurrentTableRows(page, roundText, pageNumber) {
  const raw = await page.locator(SEL.table).evaluate((table, meta) => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

    const headerRow = table.querySelector('tr');
    const headers = headerRow
      ? Array.from(headerRow.querySelectorAll('th,td')).map((cell) => clean(cell.textContent))
      : [];

    const trs = Array.from(table.querySelectorAll('tr'));
    const bodyRows = [];

    for (let i = 1; i < trs.length; i += 1) {
      const tds = Array.from(trs[i].querySelectorAll('td'));
      if (!tds.length) continue;

      const cells = tds.map((td) => clean(td.textContent));
      if (cells.length !== headers.length) continue;
      if (cells.every((x) => !x)) continue;

      bodyRows.push({
        headers,
        cells,
        round: meta.roundText,
        tablePage: meta.pageNumber,
        sourceUrl: window.location.href,
      });
    }

    return bodyRows;
  }, { roundText, pageNumber });

  return raw.map((row) => normalizeTableRow(row));
}

function normalizeTableRow(row) {
  const headers = row.headers || [];
  const cells = row.cells || [];

  const rec = {
    source: 'josaa_orcr_all_filters_all',
    source_url: row.sourceUrl,
    extracted_at: new Date().toISOString(),
    round: row.round,
    table_page: row.tablePage,
    raw_headers: headers,
    raw_cells: cells,
  };

  for (let i = 0; i < headers.length; i += 1) {
    const key = headers[i]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    rec[key] = cells[i] ?? null;
  }

  rec.institute_name = rec.institute || rec.institute_name || null;
  rec.academic_program_name = rec.academic_program_name || null;
  rec.quota = rec.quota || null;
  rec.seat_type = rec.seat_type || null;
  rec.gender = rec.gender || null;

  const open = parseRank(rec.opening_rank);
  const close = parseRank(rec.closing_rank);

  rec.opening_rank_raw = open.raw;
  rec.opening_rank_numeric = open.numeric;
  rec.opening_rank_preparatory = open.preparatory;
  rec.closing_rank_raw = close.raw;
  rec.closing_rank_numeric = close.numeric;
  rec.closing_rank_preparatory = close.preparatory;

  rec.cei_stable_key = [
    rec.round,
    rec.table_page,
    rec.institute_name || '',
    rec.academic_program_name || '',
    rec.quota || '',
    rec.seat_type || '',
    rec.gender || '',
    rec.opening_rank_raw || '',
    rec.closing_rank_raw || '',
  ].join('||');

  return rec;
}

function parseRank(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return { raw: null, numeric: null, preparatory: false };
  }

  const preparatory = /P$/i.test(raw);
  const clean = raw.replace(/P$/i, '').replace(/,/g, '').trim();
  const numeric = /^\d+$/.test(clean) ? Number(clean) : null;

  return { raw, numeric, preparatory };
}

async function gotoNextTablePage(page) {
  const candidates = [
    `${SEL.table} a[href*='Page$Next']`,
    `${SEL.table} a:has-text("Next")`,
    `${SEL.table} a[title='Next']`,
    `${SEL.table} a:has-text(">")`,
  ];

  let next = null;
  for (const selector of candidates) {
    const loc = page.locator(selector).first();
    if (await loc.count()) {
      next = loc;
      break;
    }
  }

  if (!next) {
    return false;
  }

  const previousViewState = await readViewState(page);
  try {
    await next.click({ force: true });
  } catch (error) {
    return false;
  }

  await waitForViewStateChange(page, previousViewState);
  await page.locator(SEL.table).waitFor({ state: 'attached' });
  await page.waitForFunction(
    (selector) => {
      const table = document.querySelector(selector);
      return !!table && table.querySelectorAll('tr').length > 1;
    },
    SEL.table,
    { timeout: WAIT.timeout }
  ).catch(() => null);

  return true;
}

async function appendNdjson(filePath, rows) {
  if (!rows.length) return;
  const payload = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await fs.appendFile(filePath, payload, 'utf8');
}

function log(label, value) {
  console.log(`${String(label).padEnd(14)}: ${value}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
