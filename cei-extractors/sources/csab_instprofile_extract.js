#!/usr/bin/env node

/**
 * CSAB institute profile extractor
 *
 * Scope:
 * - Reads institute rows from csab_institutes.ndjson
 * - Visits each InstProfile.aspx page
 * - Extracts institute-level profile metadata when present
 * - Extracts academic-program-wise seat breakup rows
 * - Writes one NDJSON row per seat-matrix row for CEI raw ingestion
 *
 * Notes:
 * - Built to handle the same non-rectangular 3-row DOM pattern seen on JoSAA-like seat tables:
 *   1) anchor row: program code + program name + state scope + Gender-Neutral + counts + merged totals
 *   2) redundant totals-only row: e.g. [105, 0]
 *   3) inherited Female-only row: same program/state, omitted leading columns
 * - If a page does not expose the structured seat table, it is skipped and logged in meta.
 *
 * Install:
 *   npm i playwright fs-extra minimist
 *   npx playwright install chromium
 *
 * Usage:
 *   node csab_instprofile_extract.js --in=./output/csab_institutes.ndjson --out=./output/csab_instprofile_seat_rows.ndjson
 *   node csab_instprofile_extract.js --in=./output/csab_institutes.ndjson --out=./output/csab_instprofile_seat_rows.ndjson --headful
 */

const path = require('path');
const fs = require('fs-extra');
const minimist = require('minimist');
const { chromium } = require('playwright');

const argv = minimist(process.argv.slice(2), {
  boolean: ['headful', 'debug'],
  string: ['in', 'out'],
  default: {
    headful: false,
    debug: false,
    out: path.resolve(process.cwd(), 'output', 'csab_instprofile_seat_rows.ndjson'),
  },
});

const INPUT_PATH = argv.in ? path.resolve(argv.in) : null;
const OUTPUT_PATH = path.resolve(argv.out);
const OUTPUT_DIR = path.dirname(OUTPUT_PATH);
const META_PATH = path.join(OUTPUT_DIR, 'csab_instprofile_seat_rows.meta.json');

if (!INPUT_PATH) {
  console.error('Missing required arg: --in=./output/csab_institutes.ndjson');
  process.exit(1);
}

const WAIT = {
  timeout: 45000,
  medium: 800,
};

const FIXED_HEADERS = [
  'Institute Code',
  'Institute Name',
  'Program Code',
  'Academic Program Name',
  'State/All India Seats',
  'Seat Pool',
  'OPEN',
  'OPEN-PwD',
  'GEN-EWS',
  'GEN-EWS-PwD',
  'SC',
  'SC-PwD',
  'ST',
  'ST-PwD',
  'OBC-NCL',
  'OBC-NCL-PwD',
  'Total (includes Female Supernumerary)',
  'Program-Total | Seat Capacity',
  'Program-Total | Female Supernumerary',
];

async function main() {
  const institutes = readNdjson(INPUT_PATH);
  if (!institutes.length) {
    throw new Error(`No institute rows found in ${INPUT_PATH}`);
  }

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
    input_path: INPUT_PATH,
    output_path: OUTPUT_PATH,
    started_at: new Date().toISOString(),
    institutes_read: institutes.length,
    institutes_visited: 0,
    institutes_with_table: 0,
    institutes_without_table: 0,
    rows_written: 0,
    skipped_missing_profile_url: 0,
    errors: [],
  };

  try {
    for (const inst of institutes) {
      if (!inst.profile_url) {
        meta.skipped_missing_profile_url += 1;
        continue;
      }

      meta.institutes_visited += 1;
      try {
        const rows = await extractProfileSeatRows(page, inst);
        if (!rows.length) {
          meta.institutes_without_table += 1;
          continue;
        }

        meta.institutes_with_table += 1;
        meta.rows_written += rows.length;
        await appendNdjson(OUTPUT_PATH, rows);
      } catch (error) {
        meta.errors.push({
          institute_code: inst.institute_code || null,
          institute_name: inst.institute_name || null,
          profile_url: inst.profile_url,
          error: error.message || String(error),
        });
      }
    }
  } finally {
    await browser.close();
  }

  meta.finished_at = new Date().toISOString();
  await fs.writeJson(META_PATH, meta, { spaces: 2 });

  console.log(`DONE: wrote ${meta.rows_written} seat rows to ${OUTPUT_PATH}`);
  console.log(JSON.stringify(meta, null, 2));
}

async function extractProfileSeatRows(page, inst) {
  await page.goto(inst.profile_url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(WAIT.medium);

  const tableIndex = await resolveSeatBreakupTableIndex(page);
  if (tableIndex == null) {
    return [];
  }

  const table = page.locator('table').nth(tableIndex);

  const extracted = await table.evaluate((tableEl, meta) => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const fixedHeaders = meta.fixedHeaders;
    const instituteCode = meta.instituteCode || null;
    const instituteName = meta.instituteName || null;
    const profileUrl = window.location.href;

    function looksLikeSeatPool(text) {
      const t = clean(text).toLowerCase();
      return (
        t === 'gender-neutral' ||
        t === 'female-only' ||
        t === 'female-only (including supernumerary)'
      );
    }

    function parseProgramTotals(rawText) {
      const raw = clean(rawText);
      const nums = raw.match(/-?\d+/g) || [];
      return {
        seatCapacityRaw: nums[0] || null,
        femaleSupernumeraryRaw: nums[1] || null,
      };
    }

    function buildFullCells(ctx, payload) {
      return [
        instituteCode,
        instituteName,
        ctx.programCode,
        ctx.programName,
        ctx.stateSeats,
        payload.seatPool,
        payload.open,
        payload.openPwd,
        payload.genEws,
        payload.genEwsPwd,
        payload.sc,
        payload.scPwd,
        payload.st,
        payload.stPwd,
        payload.obcNcl,
        payload.obcNclPwd,
        payload.total,
        ctx.programTotalSeatCapacityRaw,
        ctx.programTotalFemaleSupernumeraryRaw,
      ].map((x) => clean(x || ''));
    }

    const rows = Array.from(tableEl.querySelectorAll('tr')).map((tr) =>
      Array.from(tr.children).map((cell) => ({
        text: clean(cell.textContent),
        tag: cell.tagName.toLowerCase(),
        rowspan: Number(cell.getAttribute('rowspan') || '1'),
        colspan: Number(cell.getAttribute('colspan') || '1'),
      }))
    );

    const out = [];
    let currentCtx = null;

    for (let i = 0; i < rows.length; i += 1) {
      const cells = rows[i];
      const texts = cells.map((c) => clean(c.text));
      if (!texts.length) continue;

      const rowText = texts.join(' ').toLowerCase();

      // Skip obvious header / label rows.
      if (cells.some((c) => c.tag === 'th')) continue;
      if (rowText === 'program-total') continue;
      if (rowText === 'seat capacity female supernumerary') continue;
      if (rowText.includes('academic programwise seats breakup')) continue;

      // Redundant totals-only row like [105, 0]
      if (texts.length === 2 && /^-?\d+$/.test(texts[0]) && /^-?\d+$/.test(texts[1])) {
        continue;
      }

      // Anchor row with program code + program name + state scope + seat pool + counts + merged totals.
      if (
        texts.length >= 16 &&
        texts[0] &&
        texts[1] &&
        texts[2] &&
        looksLikeSeatPool(texts[3])
      ) {
        const totals = parseProgramTotals(texts[15] || texts[16] || '');
        currentCtx = {
          programCode: texts[0],
          programName: texts[1],
          stateSeats: texts[2],
          programTotalSeatCapacityRaw: totals.seatCapacityRaw,
          programTotalFemaleSupernumeraryRaw: totals.femaleSupernumeraryRaw,
        };

        const fullCells = buildFullCells(currentCtx, {
          seatPool: texts[3],
          open: texts[4],
          openPwd: texts[5],
          genEws: texts[6],
          genEwsPwd: texts[7],
          sc: texts[8],
          scPwd: texts[9],
          st: texts[10],
          stPwd: texts[11],
          obcNcl: texts[12],
          obcNclPwd: texts[13],
          total: texts[14],
        });

        out.push({
          pageNumber: 1,
          headers: fixedHeaders,
          cells: fullCells,
          sourceUrl: profileUrl,
        });
        continue;
      }

      // Inherited row with omitted program/state, usually Female-only.
      if (currentCtx && looksLikeSeatPool(texts[0]) && texts.length >= 12) {
        const fullCells = buildFullCells(currentCtx, {
          seatPool: texts[0],
          open: texts[1],
          openPwd: texts[2],
          genEws: texts[3],
          genEwsPwd: texts[4],
          sc: texts[5],
          scPwd: texts[6],
          st: texts[7],
          stPwd: texts[8],
          obcNcl: texts[9],
          obcNclPwd: texts[10],
          total: texts[11],
        });

        out.push({
          pageNumber: 1,
          headers: fixedHeaders,
          cells: fullCells,
          sourceUrl: profileUrl,
        });
        continue;
      }

      // Fallback: full rectangular row with explicit totals already split.
      if (
        texts.length >= 17 &&
        texts[0] &&
        texts[1] &&
        texts[2] &&
        looksLikeSeatPool(texts[3])
      ) {
        const fullCells = [
          instituteCode,
          instituteName,
          texts[0],
          texts[1],
          texts[2],
          texts[3],
          texts[4],
          texts[5],
          texts[6],
          texts[7],
          texts[8],
          texts[9],
          texts[10],
          texts[11],
          texts[12],
          texts[13],
          texts[14],
          texts[15],
          texts[16],
        ].map((x) => clean(x || ''));

        out.push({
          pageNumber: 1,
          headers: fixedHeaders,
          cells: fullCells,
          sourceUrl: profileUrl,
        });
      }
    }

    return out;
  }, {
    fixedHeaders: FIXED_HEADERS,
    instituteCode: inst.institute_code || null,
    instituteName: inst.institute_name || null,
  });

  return extracted.map(normalizeProfileSeatRow);
}

async function resolveSeatBreakupTableIndex(page) {
  const tables = page.locator('table');
  const count = await tables.count();

  let bestIndex = null;
  let bestScore = -1;

  for (let i = 0; i < count; i += 1) {
    const score = await tables.nth(i).evaluate((table) => {
      const text = (table.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      let score = 0;
      if (text.includes('academic programwise seats breakup')) score += 5;
      if (text.includes('state/all india seats') || text.includes('all india seats')) score += 2;
      if (text.includes('seat pool')) score += 2;
      if (text.includes('program code')) score += 2;
      if (text.includes('open-pwd')) score += 1;
      if (text.includes('obc-ncl-pwd')) score += 1;
      if (text.includes('female supernumerary')) score += 1;
      return score;
    }).catch(() => 0);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore >= 7 ? bestIndex : null;
}

function normalizeProfileSeatRow(row) {
  const headers = Array.isArray(row.headers) ? row.headers : [];
  const cells = Array.isArray(row.cells) ? row.cells : [];

  const rec = {
    source: 'csab_instprofile_seat_breakup',
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
    rec[field] = parseCount(rec[field]);
  }

  rec.entity_key = [
    'CSAB',
    normalizeKeyPart(rec.institute_code),
    normalizeKeyPart(rec.program_code),
    normalizeKeyPart(rec.state_all_india_seats),
    normalizeKeyPart(rec.seat_pool),
  ].join('||');

  rec.source_row_fingerprint = [
    rec.entity_key,
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
    'Institute Code': 'institute_code',
    'Institute Name': 'institute_name',
    'Program Code': 'program_code',
    'Academic Program Name': 'program_name',
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

function readNdjson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function appendNdjson(filePath, rows) {
  if (!rows.length) return;
  const payload = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await fs.appendFile(filePath, payload, 'utf8');
}

function parseCount(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  const match = raw.match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeKeyPart(value) {
  return normalizeText(value).toLowerCase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
