#!/usr/bin/env node

/**
 * JoSAA Seat Matrix extractor (ALL / ALL / ALL)
 *
 * Why this version exists:
 * - The seat-matrix page does not reliably expose the same native select ids
 *   as OR-CR.
 * - The table should be resolved only after submit, not at startup.
 * - The visible UI already defaults to ALL / ALL / ALL, so hidden-select
 *   discovery is optional, not mandatory.
 *
 * Usage:
 *   npm i playwright fs-extra minimist
 *   npx playwright install chromium
 *   node josaa_seat_matrix_all_extract_v2.js --headful
 *   node josaa_seat_matrix_all_extract_v2.js --out=./output/josaa_seat_matrix_all.ndjson
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
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => null);
    await page.waitForTimeout(WAIT.medium);

    const resolved = {
      instituteType: await tryResolveSelector(page, SEL.instituteType),
      institute: await tryResolveSelector(page, SEL.institute),
      program: await tryResolveSelector(page, SEL.program),
      submit: await resolveSelector(page, SEL.submit),
      viewState: await resolveSelector(page, SEL.viewState),
      tableIndex: null,
    };

    log('Resolved selectors', JSON.stringify({
      instituteType: resolved.instituteType,
      institute: resolved.institute,
      program: resolved.program,
      submit: resolved.submit,
      viewState: resolved.viewState,
    }, null, 2));

    await page.locator(resolved.submit).waitFor({ state: 'visible' });

    // Optional: if hidden native selects are discoverable, force ALL. If not,
    // rely on the page's visible default ALL / ALL / ALL state.
    if (resolved.instituteType) {
      await safeForceSelectText(page, resolved, resolved.instituteType, 'Institute Type', 'ALL');
    }
    if (resolved.institute) {
      await safeForceSelectText(page, resolved, resolved.institute, 'Institute', 'ALL');
    }
    if (resolved.program) {
      await safeForceSelectText(page, resolved, resolved.program, 'Program', 'ALL');
    }

    await submitFilters(page, resolved);

    const rows = await collectAllTablePages(page, resolved);
    await appendNdjson(OUTPUT_PATH, rows);

    await fs.writeJson(META_PATH, {
      target_url: TARGET_URL,
      output_path: OUTPUT_PATH,
      extracted_at: new Date().toISOString(),
      total_rows: rows.length,
      table_index: resolved.tableIndex,
    }, { spaces: 2 });

    log('DONE', `Wrote ${rows.length} rows to ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

async function resolveSelector(page, candidates) {
  for (const candidate of candidates) {
    const loc = page.locator(candidate).first();
    if (await loc.count()) return candidate;
  }
  throw new Error(`Could not resolve selector from candidates: ${candidates.join(', ')}`);
}

async function tryResolveSelector(page, candidates) {
  for (const candidate of candidates) {
    const loc = page.locator(candidate).first();
    if (await loc.count()) return candidate;
  }
  return null;
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

async function safeForceSelectText(page, resolved, selector, label, desiredText) {
  try {
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
      };
    }, desiredText);

    if (String(state.currentText || '').toUpperCase() === String(desiredText).toUpperCase()) {
      return;
    }

    if (!state.targetValue) {
      return;
    }

    const previousViewState = await readViewState(page, resolved);

    try {
      await page.locator(selector).evaluate((el, payload) => {
        const option = Array.from(el.options).find((o) => o.value === payload.targetValue);
        if (!option) return;

        el.value = payload.targetValue;
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
  } catch (error) {
    log('WARN', `Skipping force-select for ${label}: ${error.message}`);
  }
}

async function submitFilters(page, resolved) {
  const previousViewState = await readViewState(page, resolved);
  await page.locator(resolved.submit).click({ force: true });
  await waitForViewStateChange(page, resolved, previousViewState);

  resolved.tableIndex = await resolveSeatMatrixTableIndex(page);
  const tableLoc = getTableLocator(page, resolved);
  await tableLoc.waitFor({ state: 'attached' });
  await page.waitForFunction(
    ({ index }) => {
      const tables = document.querySelectorAll('table');
      const table = tables[index];
      return !!table && table.querySelectorAll('tr').length > 2;
    },
    { index: resolved.tableIndex },
    { timeout: WAIT.timeout }
  );
}

async function resolveSeatMatrixTableIndex(page) {
  const tables = page.locator('table');
  const count = await tables.count();

  for (let i = 0; i < count; i += 1) {
    const loc = tables.nth(i);
    const score = await loc.evaluate((table) => {
      const text = (table.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      let score = 0;
      if (text.includes('institute name')) score += 3;
      if (text.includes('program name')) score += 3;
      if (text.includes('seat pool')) score += 3;
      if (text.includes('seat capacity')) score += 2;
      if (text.includes('program-total')) score += 2;
      if (text.includes('open-pwd')) score += 1;
      if (text.includes('gen-ews')) score += 1;
      return score;
    }).catch(() => 0);

    if (score >= 8) {
      return i;
    }
  }

  throw new Error('Could not resolve seat matrix table after submit');
}

function getTableLocator(page, resolved) {
  if (resolved.tableIndex == null) {
    throw new Error('tableIndex is not resolved');
  }
  return page.locator('table').nth(resolved.tableIndex);
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
  const tableLoc = getTableLocator(page, resolved);

  const rawRows = await tableLoc.evaluate((table, meta) => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

    function tableSectionRows(root) {
      const rows = Array.from(root.querySelectorAll('tr'));
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

    const allRows = tableSectionRows(table);
    const headerRowCount = allRows.filter((row) => row.some((cell) => cell.tag === 'th')).length;
    const headerDefs = allRows.slice(0, headerRowCount);
    const bodyDefs = allRows.slice(headerRowCount);

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
  const tableLoc = getTableLocator(page, resolved);
  const candidates = [
    tableLoc.locator("a[href*='Page$Next']").first(),
    tableLoc.locator("a[title='Next']").first(),
    tableLoc.locator('a:has-text("Next")').first(),
  ];

  let next = null;
  for (const loc of candidates) {
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
  const freshTable = getTableLocator(page, resolved);
  await freshTable.waitFor({ state: 'attached' });
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
