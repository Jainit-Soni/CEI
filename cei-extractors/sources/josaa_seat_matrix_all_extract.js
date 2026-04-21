#!/usr/bin/env node

/**
 * JoSAA Seat Matrix extractor (ALL filters)
 *
 * Goal:
 * - Open the official JoSAA seat matrix page
 * - Force Institute Type = ALL, Institute = ALL, Program = ALL
 * - Submit
 * - Extract the seat matrix table, including multi-row headers and rowspans
 * - Follow pagination if present
 * - Write NDJSON rows for CEI ingestion
 *
 * Usage:
 *   node josaa_seat_matrix_all_extract.js --headful
 *   node josaa_seat_matrix_all_extract.js --out=./output/josaa_seat_matrix_all.ndjson
 *
 * Install:
 *   npm i playwright fs-extra minimist
 *   npx playwright install chromium
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
    out: path.resolve(process.cwd(), 'output', 'josaa_seat_matrix_all.ndjson'),
  },
});

const TARGET_URL = 'https://josaa.admissions.nic.in/applicant/seatmatrix/seatmatrixinfo.aspx';
const OUTPUT_PATH = path.resolve(argv.out);
const OUTPUT_DIR = path.dirname(OUTPUT_PATH);
const META_PATH = path.join(OUTPUT_DIR, 'josaa_seat_matrix_all.meta.json');

const SEL = {
  instituteType: [
    '#ctl00_ContentPlaceHolder1_ddlInstype',
    'select[name*="ddlInstype"]',
    'select[id*="ddlInstype"]',
    'select:near(:text("Institute Type"))',
    'select:near(:text("Institute Type:"))',
  ],
  institute: [
    '#ctl00_ContentPlaceHolder1_ddlInstitute',
    'select[name*="ddlInstitute"]',
    'select[id*="ddlInstitute"]',
    'select:near(:text("Select Institute"))',
    'select:near(:text("Select Institute:"))',
    'select:near(:text("Institute"))',
  ],
  program: [
    '#ctl00_ContentPlaceHolder1_ddlBranch',
    'select[name*="ddlBranch"]',
    'select[id*="ddlBranch"]',
    'select[name*="ddlProgram"]',
    'select[id*="ddlProgram"]',
    'select:near(:text("Select Program"))',
    'select:near(:text("Select Program:"))',
    'select:near(:text("Program"))',
  ],
  submit: [
    '#ctl00_ContentPlaceHolder1_btnSubmit',
    'input[type="submit"]',
    'button:has-text("Submit")',
    'input[value="Submit"]',
  ],
  table: [
    '#ctl00_ContentPlaceHolder1_GridView1',
    'table:has-text("Institute Name")',
    'table:has-text("Program Name")',
    'table:has(th:text("Institute Name"))',
  ],
  viewState: [
    '#__VIEWSTATE',
    'input[name="__VIEWSTATE"]',
  ],
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
    viewport: { width: 1600, height: 1200 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(WAIT.timeout);

  try {
    await openFresh(page);

    const resolved = await resolveSelectors(page);
    log('Resolved selectors', JSON.stringify(resolved, null, 2));

    await ensureBasePageReady(page, resolved);
    await forceAllFilters(page, resolved);
    await submitFilters(page, resolved);

    const rows = await collectAllTablePages(page, resolved);
    await appendNdjson(OUTPUT_PATH, rows);

    const meta = {
      target_url: TARGET_URL,
      output_path: OUTPUT_PATH,
      extracted_at: new Date().toISOString(),
      total_rows: rows.length,
    };
    await fs.writeJson(META_PATH, meta, { spaces: 2 });

    log('DONE', `Wrote ${rows.length} rows to ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

async function openFresh(page) {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(WAIT.medium);
}

async function resolveSelectors(page) {
  return {
    instituteType: await tryResolveSelector(page, SEL.instituteType),
    institute: await tryResolveSelector(page, SEL.institute),
    program: await tryResolveSelector(page, SEL.program),
    submit: await resolveSelector(page, SEL.submit),
    table: await resolveSelector(page, SEL.table),
    viewState: await resolveSelector(page, SEL.viewState),
  };
}

async function resolveSelector(page, candidates) {
  for (const candidate of candidates) {
    const loc = page.locator(candidate).first();
    if (await loc.count()) {
      return candidate;
    }
  }
  throw new Error(`Could not resolve selector from candidates: ${candidates.join(', ')}`);
}

async function tryResolveSelector(page, candidates) {
  for (const candidate of candidates) {
    const loc = page.locator(candidate).first();
    if (await loc.count()) {
      return candidate;
    }
  }
  return null;
}

async function ensureBasePageReady(page, resolved) {
  // The visible UI already opens at ALL / ALL / ALL. Do not require hidden
  // native selects to exist before extraction.
  await page.locator(resolved.submit).waitFor({ state: 'visible' });
  await page.waitForTimeout(WAIT.medium);
}

async function waitUntilSelectHasOptions(page, selector, label) {
  const started = Date.now();
  while (Date.now() - started < WAIT.timeout) {
    const state = await page.locator(selector).first().evaluate((el) => ({
      disabled: !!el.disabled,
      count: el.options ? el.options.length : 0,
      texts: el.options ? Array.from(el.options).map((o) => (o.textContent || '').trim()) : [],
    })).catch(() => null);

    if (state && !state.disabled && state.count > 0) {
      return state;
    }

    await page.waitForTimeout(200);
  }

  throw new Error(`Select never became usable: ${label}`);
}

async function readViewState(page, resolved) {
  return page.locator(resolved.viewState).inputValue().catch(() => null);
}

async function waitForViewStateChange(page, resolved, previousValue) {
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
    { selector: resolved.viewState, previousValue },
    { timeout: WAIT.timeout }
  ).catch(() => null);

  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(WAIT.medium);
}

async function forceAllFilters(page, resolved) {
  // If native selects are discoverable, force them to ALL.
  // If not, rely on the visible default ALL state and continue.
  if (resolved.instituteType) {
    await forceSelectText(page, resolved, resolved.instituteType, 'Institute Type', 'ALL');
  }
  if (resolved.institute) {
    await forceSelectText(page, resolved, resolved.institute, 'Institute', 'ALL');
  }
  if (resolved.program) {
    await forceSelectText(page, resolved, resolved.program, 'Program', 'ALL');
  }
}

async function forceSelectText(page, resolved, selector, label, desiredText) {
  if (!selector) return;

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
      name: el.name || el.id,
    };
  }, desiredText);

  if (String(state.currentText || '').toUpperCase() === String(desiredText).toUpperCase()) {
    return;
  }

  if (!state.targetValue) {
    // Hidden native select may not expose ALL cleanly. Skip instead of failing.
    return;
  }

  const previousViewState = await readViewState(page, resolved);

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

  await waitForViewStateChange(page, resolved, previousViewState);
  await page.locator(selector).waitFor({ state: 'attached' });
  await waitUntilSelectHasOptions(page, selector, label);
}

async function submitFilters(page, resolved) {
  const previousViewState = await readViewState(page, resolved);
  await page.locator(resolved.submit).click({ force: true });
  await waitForViewStateChange(page, resolved, previousViewState);
  await page.locator(resolved.table).waitFor({ state: 'attached' });
  await page.waitForFunction(
    (selector) => {
      const table = document.querySelector(selector);
      return !!table && table.querySelectorAll('tr').length > 2;
    },
    resolved.table,
    { timeout: WAIT.timeout }
  );
}

async function collectAllTablePages(page, resolved) {
  const out = [];
  const seenPageFingerprints = new Set();
  let pageNumber = 1;

  while (true) {
    const rows = await extractCurrentTableRows(page, resolved, pageNumber);
    const fingerprint = JSON.stringify({
      pageNumber,
      count: rows.length,
      first: rows[0]?.source_row_fingerprint || null,
      last: rows[rows.length - 1]?.source_row_fingerprint || null,
    });

    if (seenPageFingerprints.has(fingerprint)) break;
    seenPageFingerprints.add(fingerprint);

    out.push(...rows);

    const moved = await gotoNextTablePage(page, resolved);
    if (!moved) break;
    pageNumber += 1;
  }

  return out;
}

async function extractCurrentTableRows(page, resolved, pageNumber) {
  const rawRows = await page.locator(resolved.table).evaluate((table, meta) => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

    function tableSectionRows(root, selector) {
      const rows = Array.from(root.querySelectorAll(selector));
      return rows.map((tr) => Array.from(tr.children).map((cell) => ({
        text: clean(cell.textContent),
        tag: cell.tagName.toLowerCase(),
        rowspan: Number(cell.getAttribute('rowspan') || '1'),
        colspan: Number(cell.getAttribute('colspan') || '1'),
      })));
    }

    function expandMatrix(rowDefs) {
      const matrix = [];
      const carry = [];

      for (let r = 0; r < rowDefs.length; r += 1) {
        const row = [];
        let c = 0;

        while (carry[c] && carry[c].remaining > 0) {
          row[c] = carry[c].text;
          carry[c].remaining -= 1;
          c += 1;
        }

        for (const cell of rowDefs[r]) {
          while (row[c] !== undefined) c += 1;
          for (let x = 0; x < cell.colspan; x += 1) {
            row[c + x] = cell.text;
            if (cell.rowspan > 1) {
              carry[c + x] = { text: cell.text, remaining: cell.rowspan - 1 };
            }
          }
          c += cell.colspan;

          while (carry[c] && carry[c].remaining > 0) {
            row[c] = carry[c].text;
            carry[c].remaining -= 1;
            c += 1;
          }
        }

        matrix.push(row);
      }

      return matrix;
    }

    function flattenHeaders(headerMatrix) {
      if (!headerMatrix.length) return [];
      const width = Math.max(...headerMatrix.map((row) => row.length));
      const labels = [];

      for (let c = 0; c < width; c += 1) {
        const parts = [];
        for (let r = 0; r < headerMatrix.length; r += 1) {
          const text = clean((headerMatrix[r] && headerMatrix[r][c]) || '');
          if (!text) continue;
          if (!parts.length || parts[parts.length - 1] !== text) {
            parts.push(text);
          }
        }
        labels.push(parts.join(' | '));
      }

      return labels;
    }

    function isPagerLike(cells) {
      const joined = cells.join(' ').toLowerCase();
      if (joined.includes('next') || joined.includes('previous') || joined.includes('page')) return true;
      if (joined.includes('...')) return true;
      return false;
    }

    const allRows = Array.from(table.querySelectorAll('tr'));
    const headerRowCount = allRows.filter((tr) => tr.querySelector('th')).length;

    const headerDefs = tableSectionRows(table, 'tr').slice(0, headerRowCount);
    const bodyDefs = tableSectionRows(table, 'tr').slice(headerRowCount);

    const headerMatrix = expandMatrix(headerDefs);
    const headers = flattenHeaders(headerMatrix);
    const bodyMatrix = expandMatrix(bodyDefs);

    const out = [];
    for (const cells of bodyMatrix) {
      const normalizedCells = headers.map((_, idx) => clean(cells[idx] || ''));
      if (!normalizedCells.some(Boolean)) continue;
      if (isPagerLike(normalizedCells)) continue;

      out.push({
        pageNumber: meta.pageNumber,
        headers,
        cells: normalizedCells,
        sourceUrl: window.location.href,
      });
    }

    return out;
  }, { pageNumber });

  return rawRows.map(normalizeSeatMatrixRow);
}

function normalizeSeatMatrixRow(row) {
  const headers = Array.isArray(row.headers) ? row.headers : [];
  const cells = Array.isArray(row.cells) ? row.cells : [];

  const rec = {
    source: 'josaa_seat_matrix_all_filters_all',
    source_url: row.sourceUrl,
    extracted_at: new Date().toISOString(),
    table_page: row.pageNumber,
    raw_headers: headers,
    raw_cells: cells,
  };

  for (let i = 0; i < headers.length; i += 1) {
    const key = headerToKey(headers[i]);
    if (!key) continue;
    rec[key] = cells[i] ?? null;
  }

  rec.institute_name = rec.institute_name || null;
  rec.program_name = rec.program_name || null;
  rec.state_all_india_seats = rec.state_all_india_seats || null;
  rec.seat_pool = rec.seat_pool || null;

  const numericFields = [
    'open',
    'open_pwd',
    'gen_ews',
    'gen_ews_pwd',
    'sc',
    'sc_pwd',
    'st',
    'st_pwd',
    'obc_ncl',
    'obc_ncl_pwd',
    'total_includes_female_supernumerary',
    'program_total_seat_capacity',
    'program_total_female_supernumerary',
  ];

  for (const field of numericFields) {
    rec[`${field}_raw`] = rec[field] ?? null;
    rec[field] = parseSeatCount(rec[field]);
  }

  rec.source_row_fingerprint = [
    normalizeText(rec.institute_name),
    normalizeText(rec.program_name),
    normalizeText(rec.state_all_india_seats),
    normalizeText(rec.seat_pool),
    rec.open ?? '',
    rec.open_pwd ?? '',
    rec.gen_ews ?? '',
    rec.gen_ews_pwd ?? '',
    rec.sc ?? '',
    rec.sc_pwd ?? '',
    rec.st ?? '',
    rec.st_pwd ?? '',
    rec.obc_ncl ?? '',
    rec.obc_ncl_pwd ?? '',
    rec.total_includes_female_supernumerary ?? '',
    rec.program_total_seat_capacity ?? '',
    rec.program_total_female_supernumerary ?? '',
  ].join('||');

  return rec;
}

function headerToKey(label) {
  const raw = normalizeText(label);
  if (!raw) return null;

  const directMap = {
    'Institute Name': 'institute_name',
    'Program Name': 'program_name',
    'State/All India Seats': 'state_all_india_seats',
    'Seat Pool': 'seat_pool',
    'OPEN': 'open',
    'OPEN-PwD': 'open_pwd',
    'GEN-EWS': 'gen_ews',
    'GEN-EWS-PwD': 'gen_ews_pwd',
    'SC': 'sc',
    'SC-PwD': 'sc_pwd',
    'ST': 'st',
    'ST-PwD': 'st_pwd',
    'OBC-NCL': 'obc_ncl',
    'OBC-NCL-PwD': 'obc_ncl_pwd',
    'Total (includes Female Supernumerary)': 'total_includes_female_supernumerary',
    'Program-Total | Seat Capacity': 'program_total_seat_capacity',
    'Program-Total | Female Supernumerary': 'program_total_female_supernumerary',
  };

  if (directMap[raw]) return directMap[raw];

  return raw
    .toLowerCase()
    .replace(/\|/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseSeatCount(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  const match = raw.match(/-?\d+/);
  if (!match) return null;
  return Number(match[0]);
}

async function gotoNextTablePage(page, resolved) {
  const candidates = [
    `${resolved.table} a[href*='Page$Next']`,
    `${resolved.table} a[title='Next']`,
    `${resolved.table} a:has-text("Next")`,
    `${resolved.table} a[href*='Page$']`,
  ];

  let next = null;
  for (const selector of candidates) {
    const loc = page.locator(selector).first();
    if (await loc.count()) {
      next = loc;
      break;
    }
  }

  if (!next) return false;

  const previousViewState = await readViewState(page, resolved);
  try {
    await next.click({ force: true });
  } catch (error) {
    return false;
  }

  await waitForViewStateChange(page, resolved, previousViewState);
  await page.locator(resolved.table).waitFor({ state: 'attached' });
  await page.waitForFunction(
    (selector) => {
      const table = document.querySelector(selector);
      return !!table && table.querySelectorAll('tr').length > 2;
    },
    resolved.table,
    { timeout: WAIT.timeout }
  ).catch(() => null);

  return true;
}

async function appendNdjson(filePath, rows) {
  if (!rows.length) return;
  const payload = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await fs.appendFile(filePath, payload, 'utf8');
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function log(label, value) {
  console.log(`${String(label).padEnd(20)}: ${value}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
