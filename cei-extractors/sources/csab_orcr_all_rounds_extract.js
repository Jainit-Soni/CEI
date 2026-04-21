#!/usr/bin/env node

/**
 * CSAB ORCR extractor (all special rounds, ALL filters)
 *
 * Goal:
 * - Open official CSAB Opening and Closing Ranks page
 * - Scrape ALL / ALL / ALL rows for each available Special Round
 * - Follow pagination if present
 * - Write raw NDJSON rows for CEI ingestion
 *
 * Install:
 *   npm i playwright fs-extra minimist
 *   npx playwright install chromium
 *
 * Usage:
 *   node csab_orcr_all_rounds_extract.js --out=./output/csab_orcr_all_rounds.ndjson
 *   node csab_orcr_all_rounds_extract.js --headful --debug
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
    out: path.resolve(process.cwd(), 'output', 'csab_orcr_all_rounds.ndjson'),
  },
});

const TARGET_URL = 'https://admissions.nic.in/csabspl/Applicant/seatallotmentresult/currentorcr.aspx';
const OUTPUT_PATH = path.resolve(argv.out);
const OUTPUT_DIR = path.dirname(OUTPUT_PATH);
const META_PATH = path.join(OUTPUT_DIR, 'csab_orcr_all_rounds.meta.json');

const FIXED_HEADERS = [
  'Institute',
  'Academic Program Name',
  'Quota',
  'Seat Type',
  'Gender',
  'Opening Rank',
  'Closing Rank',
];

const SEL = {
  round: [
    '#ctl00_ContentPlaceHolder1_ddlroundno',
    'select[name*="ddlroundno"]',
    'select[id*="ddlroundno"]',
    'select:near(:text("Special Round"))',
    'select:near(:text("Special Round:"))',
  ],
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
    'select:near(:text("Institute Name"))',
    'select:near(:text("Institute Name:"))',
  ],
  program: [
    '#ctl00_ContentPlaceHolder1_ddlBranch',
    'select[name*="ddlBranch"]',
    'select[id*="ddlBranch"]',
    'select[name*="ddlProgram"]',
    'select[id*="ddlProgram"]',
    'select:near(:text("Academic Program"))',
    'select:near(:text("Academic Program:"))',
  ],
  submit: [
    '#ctl00_ContentPlaceHolder1_btnSubmit',
    'input[type="submit"]',
    'input[value="Submit"]',
    'button:has-text("Submit")',
  ],
  viewState: [
    '#__VIEWSTATE',
    'input[name="__VIEWSTATE"]',
  ],
};

const WAIT = {
  timeout: 45000,
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

  const meta = {
    target_url: TARGET_URL,
    output_path: OUTPUT_PATH,
    started_at: new Date().toISOString(),
    rounds_detected: [],
    rows_written: 0,
    per_round_rows: {},
  };

  try {
    await openFresh(page);

    const resolved = {
      round: await resolveSelector(page, SEL.round),
      instituteType: await tryResolveSelector(page, SEL.instituteType),
      institute: await tryResolveSelector(page, SEL.institute),
      program: await tryResolveSelector(page, SEL.program),
      submit: await resolveSelector(page, SEL.submit),
      viewState: await resolveSelector(page, SEL.viewState),
      tableIndex: null,
    };

    log('Resolved selectors', JSON.stringify({
      round: resolved.round,
      instituteType: resolved.instituteType,
      institute: resolved.institute,
      program: resolved.program,
      submit: resolved.submit,
      viewState: resolved.viewState,
    }, null, 2));

    const rounds = await getAvailableRoundTexts(page, resolved.round);
    meta.rounds_detected = rounds;

    for (const roundText of rounds) {
      await openFresh(page);

      await safeForceSelectText(page, resolved, resolved.round, 'Special Round', roundText);
      await safeForceSelectText(page, resolved, resolved.instituteType, 'Institute Type', 'ALL');
      await safeForceSelectText(page, resolved, resolved.institute, 'Institute Name', 'ALL');
      await safeForceSelectText(page, resolved, resolved.program, 'Academic Program', 'ALL');

      await submitFilters(page, resolved);

      const rows = await collectAllTablePages(page, resolved, roundText);
      await appendNdjson(OUTPUT_PATH, rows);

      meta.per_round_rows[roundText] = rows.length;
      meta.rows_written += rows.length;
    }

    meta.finished_at = new Date().toISOString();
    await fs.writeJson(META_PATH, meta, { spaces: 2 });
    log('DONE', `Wrote ${meta.rows_written} rows to ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

async function openFresh(page) {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(WAIT.medium);
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

async function getAvailableRoundTexts(page, selector) {
  const options = await page.locator(selector).evaluate((el) =>
    Array.from(el.options)
      .map((o) => (o.textContent || '').trim())
      .filter((t) => t && !/^--select--$/i.test(t))
  );
  return options.filter((t) => /^\d+$/.test(t) || /round/i.test(t));
}

async function waitUntilSelectHasOptions(page, selector, label) {
  const started = Date.now();
  while (Date.now() - started < WAIT.timeout) {
    const state = await page.locator(selector).first().evaluate((el) => ({
      disabled: !!el.disabled,
      count: el.options ? el.options.length : 0,
    })).catch(() => null);

    if (state && !state.disabled && state.count > 0) return state;
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
  if (!selector) return;

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

    if (String(state.currentText || '').toUpperCase() === String(desiredText).toUpperCase()) return;
    if (!state.targetValue) return;

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
      if (!msg.includes('Execution context was destroyed')) throw error;
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

  resolved.tableIndex = await resolveOrcrTableIndex(page);
  await getTableLocator(page, resolved).waitFor({ state: 'attached' });
}

async function resolveOrcrTableIndex(page) {
  const tables = page.locator('table');
  const count = await tables.count();

  let bestIndex = null;
  let bestScore = -1;
  for (let i = 0; i < count; i += 1) {
    const score = await tables.nth(i).evaluate((table) => {
      const text = (table.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      let score = 0;
      if (text.includes('academic program name')) score += 3;
      if (text.includes('opening rank')) score += 3;
      if (text.includes('closing rank')) score += 3;
      if (text.includes('seat type')) score += 2;
      if (text.includes('gender')) score += 2;
      if (text.includes('quota')) score += 2;
      return score;
    }).catch(() => 0);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex == null || bestScore < 8) {
    throw new Error('Could not resolve CSAB ORCR table after submit');
  }

  return bestIndex;
}

function getTableLocator(page, resolved) {
  if (resolved.tableIndex == null) throw new Error('tableIndex is not resolved');
  return page.locator('table').nth(resolved.tableIndex);
}

async function collectAllTablePages(page, resolved, roundText) {
  const out = [];
  const seenPageFingerprints = new Set();
  let pageNumber = 1;

  while (true) {
    const rows = await extractCurrentTableRows(page, resolved, roundText, pageNumber);
    const fingerprint = JSON.stringify({
      roundText,
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

async function extractCurrentTableRows(page, resolved, roundText, pageNumber) {
  const rawRows = await getTableLocator(page, resolved).evaluate((table, meta) => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

    const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
      Array.from(tr.children).map((cell) => ({
        text: clean(cell.textContent),
        tag: cell.tagName.toLowerCase(),
      }))
    );

    const out = [];
    for (const row of rows) {
      const texts = row.map((c) => c.text);
      if (!texts.some(Boolean)) continue;
      if (row.some((c) => c.tag === 'th')) continue;
      if (texts.join(' ').toLowerCase().includes('opening rank') && texts.join(' ').toLowerCase().includes('closing rank')) continue;
      if (texts.length < 7) continue;
      if (!texts[0] || !texts[1] || !texts[2] || !texts[3] || !texts[4]) continue;

      const cells = [
        texts[0],
        texts[1],
        texts[2],
        texts[3],
        texts[4],
        texts[5],
        texts[6],
      ];

      if (!cells[5] && !cells[6]) continue;

      out.push({
        specialRound: meta.roundText,
        pageNumber: meta.pageNumber,
        headers: meta.fixedHeaders,
        cells,
        sourceUrl: window.location.href,
      });
    }

    return out;
  }, { roundText, pageNumber, fixedHeaders: FIXED_HEADERS });

  return rawRows.map(normalizeOrcrRow);
}

function normalizeOrcrRow(row) {
  const headers = Array.isArray(row.headers) ? row.headers : [];
  const cells = Array.isArray(row.cells) ? row.cells : [];

  const rec = {
    source: 'csab_orcr_all_filters_all',
    source_url: row.sourceUrl,
    extracted_at: new Date().toISOString(),
    special_round: normalizeRound(row.specialRound),
    table_page: row.pageNumber,
    raw_headers: headers,
    raw_cells: cells,
    rank_basis: 'ALL_INDIA_CRL',
  };

  for (let i = 0; i < headers.length; i += 1) {
    const key = headerToKey(headers[i]);
    if (!key) continue;
    rec[key] = cells[i] ?? null;
  }

  rec.opening_rank_raw = rec.opening_rank ?? null;
  rec.closing_rank_raw = rec.closing_rank ?? null;

  const openingParsed = parseRank(rec.opening_rank_raw);
  const closingParsed = parseRank(rec.closing_rank_raw);

  rec.opening_rank = openingParsed.numeric;
  rec.opening_rank_preparatory = openingParsed.preparatory;
  rec.closing_rank = closingParsed.numeric;
  rec.closing_rank_preparatory = closingParsed.preparatory;

  rec.entity_key = [
    'CSAB',
    rec.special_round ?? '',
    normalizeKeyPart(rec.institute),
    normalizeKeyPart(rec.academic_program_name),
    normalizeKeyPart(rec.quota),
    normalizeKeyPart(rec.seat_type),
    normalizeKeyPart(rec.gender),
  ].join('||');

  rec.source_row_fingerprint = [
    rec.entity_key,
    rec.opening_rank_raw || '',
    rec.closing_rank_raw || '',
  ].join('||');

  return rec;
}

function normalizeRound(value) {
  const text = String(value || '').trim();
  const m = text.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function headerToKey(label) {
  const raw = normalizeText(label);
  const directMap = {
    'Institute': 'institute',
    'Academic Program Name': 'academic_program_name',
    'Quota': 'quota',
    'Seat Type': 'seat_type',
    'Gender': 'gender',
    'Opening Rank': 'opening_rank',
    'Closing Rank': 'closing_rank',
  };
  return directMap[raw] || raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function parseRank(value) {
  const raw = normalizeText(value);
  if (!raw) return { raw: null, numeric: null, preparatory: false };
  const preparatory = /P$/i.test(raw);
  const clean = raw.replace(/P$/i, '').replace(/,/g, '').trim();
  const numeric = /^\d+$/.test(clean) ? Number(clean) : null;
  return { raw, numeric, preparatory };
}

async function gotoNextTablePage(page, resolved) {
  const tableLoc = getTableLocator(page, resolved);

  const directNextCandidates = [
    tableLoc.locator("a[href*='Page$Next']").first(),
    tableLoc.locator("a[title='Next']").first(),
    tableLoc.locator('a:has-text("Next")').first(),
  ];

  for (const loc of directNextCandidates) {
    if (await loc.count()) {
      const previousViewState = await readViewState(page, resolved);
      try {
        await loc.click({ force: true });
      } catch (error) {
        return false;
      }
      await waitForViewStateChange(page, resolved, previousViewState);
      await getTableLocator(page, resolved).waitFor({ state: 'attached' });
      return true;
    }
  }

  const pagerInfo = await tableLoc.evaluate((table) => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const pagerRow = Array.from(table.querySelectorAll('tr')).find((tr) => {
      const text = clean(tr.textContent).toLowerCase();
      return text.includes('next') || text.includes('previous') || /\d+/.test(text);
    });

    if (!pagerRow) return { currentPage: null, nextPage: null };

    const currentCandidates = Array.from(pagerRow.querySelectorAll('span, td')).map((el) => clean(el.textContent));
    const currentPage = currentCandidates.find((t) => /^\d+$/.test(t)) || null;
    const linkTexts = Array.from(pagerRow.querySelectorAll('a')).map((a) => clean(a.textContent));

    if (currentPage && /^\d+$/.test(currentPage)) {
      const expected = String(Number(currentPage) + 1);
      if (linkTexts.includes(expected)) return { currentPage, nextPage: expected };
    }

    const numericLinks = linkTexts.filter((t) => /^\d+$/.test(t)).map(Number).sort((a, b) => a - b);
    if (!numericLinks.length) return { currentPage, nextPage: null };
    if (!currentPage || !/^\d+$/.test(currentPage)) return { currentPage, nextPage: String(numericLinks[0]) };

    const next = numericLinks.find((n) => n > Number(currentPage));
    return { currentPage, nextPage: next != null ? String(next) : null };
  });

  if (!pagerInfo.nextPage) return false;

  const numericLoc = tableLoc.locator(`a:has-text("${pagerInfo.nextPage}")`).first();
  if (!(await numericLoc.count())) return false;

  const previousViewState = await readViewState(page, resolved);
  try {
    await numericLoc.click({ force: true });
  } catch (error) {
    return false;
  }

  await waitForViewStateChange(page, resolved, previousViewState);
  await getTableLocator(page, resolved).waitFor({ state: 'attached' });
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

function normalizeKeyPart(value) {
  return normalizeText(value).toLowerCase();
}

function log(label, value) {
  console.log(`${String(label).padEnd(20)}: ${value}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});