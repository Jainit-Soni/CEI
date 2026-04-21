#!/usr/bin/env node

/**
 * CSAB institute profile extractor (text parser, v3)
 *
 * Fix vs v2:
 * - Anchor rows on CSAB pages end with 11 category-count numbers, NOT 13.
 * - The final 2 program-total numbers are emitted on the NEXT line, e.g.:
 *     201 4104 Bio Technology ... PUNJAB Gender-Neutral 8 0 1 1 3 0 2 0 5 0 20
 *     25 0
 * - Female-only rows also end with 11 numbers and inherit those totals.
 *
 * Install:
 *   npm i playwright fs-extra minimist
 *   npx playwright install chromium
 *
 * Usage:
 *   node csab_instprofile_extract_text_v3.js --in=./output/csab_institutes.ndjson --out=./output/csab_instprofile_seat_rows.ndjson
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

const HEADERS = [
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

const KNOWN_STATE_SCOPES = [
  'ALL INDIA', 'HOME STATE', 'OTHER STATE',
  'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHHATTISGARH',
  'DELHI', 'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JHARKHAND',
  'KARNATAKA', 'KERALA', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR',
  'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'PUNJAB', 'RAJASTHAN',
  'SIKKIM', 'TAMIL NADU', 'TELANGANA', 'TRIPURA', 'UTTAR PRADESH',
  'UTTARAKHAND', 'WEST BENGAL',
];

async function main() {
  const institutes = readNdjson(INPUT_PATH);
  if (!institutes.length) throw new Error(`No institute rows found in ${INPUT_PATH}`);

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
    institutes_with_section: 0,
    institutes_without_section: 0,
    rows_written: 0,
    skipped_missing_profile_url: 0,
    errors: [],
    first_missing_examples: [],
  };

  try {
    for (const inst of institutes) {
      if (!inst.profile_url) {
        meta.skipped_missing_profile_url += 1;
        continue;
      }

      meta.institutes_visited += 1;

      try {
        const result = await extractProfileSeatRows(page, inst);
        if (!result.rows.length) {
          meta.institutes_without_section += 1;
          if (meta.first_missing_examples.length < 5) {
            meta.first_missing_examples.push({
              institute_code: inst.institute_code || null,
              institute_name: inst.institute_name || null,
              profile_url: inst.profile_url,
              lines_preview: result.linesPreview,
            });
          }
          continue;
        }

        meta.institutes_with_section += 1;
        meta.rows_written += result.rows.length;
        await appendNdjson(OUTPUT_PATH, result.rows);
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

  const section = await page.evaluate(() => {
    const normalize = (s) => (s || '').replace(/\u00a0/g, ' ').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
    const bodyText = document.body?.innerText || '';
    const match = bodyText.match(/Academic\s+Programwise\s+Seats\s+breakup/i);
    if (!match) {
      const allLines = bodyText.split(/\n+/).map((x) => normalize(x)).filter(Boolean);
      return { lines: [], linesPreview: allLines.slice(0, 40) };
    }

    let tail = bodyText.slice(match.index + match[0].length);
    const stopRegex = /(Terms\s+and\s+Conditions|Hyperlink\s+Policy|Privacy\s+Policy|Copyright\s+Policy|Disclaimer)/i;
    const stop = tail.search(stopRegex);
    if (stop !== -1) tail = tail.slice(0, stop);

    const lines = tail.split(/\n+/).map((x) => normalize(x)).filter(Boolean);
    return { lines, linesPreview: lines.slice(0, 20) };
  });

  const lines = stripNonDataLines(section.lines || []);
  const rows = parseSeatBreakupLines(lines, inst);

  return { rows, linesPreview: section.linesPreview || [] };
}

function stripNonDataLines(lines) {
  return lines.filter((line) => {
    const t = normalizeText(line);
    if (!t) return false;
    if (/^Institute Code\s+Program Code\s+Academic Program Name/i.test(t)) return false;
    if (/^Seat Capacity\s+Female Supernumerary/i.test(t)) return false;
    if (/^Program-Total$/i.test(t)) return false;
    return true;
  });
}

function parseSeatBreakupLines(lines, inst) {
  const rows = [];
  let currentCtx = null;

  for (let i = 0; i < lines.length; i += 1) {
    const t = normalizeText(lines[i]);
    if (!t) continue;
    if (/^\(including\s+"?\d+"?\s+Supernumerary\)/i.test(t)) continue;
    if (/^Total Seats\b/i.test(t)) continue;

    const totalsLine = normalizeText(lines[i + 1] || '');
    const totalsPair = parseTotalsPairLine(totalsLine);

    const anchor = parseAnchorLine(t, inst, totalsPair);
    if (anchor) {
      currentCtx = {
        institute_code: anchor.institute_code,
        institute_name: anchor.institute_name,
        program_code: anchor.program_code,
        program_name: anchor.program_name,
        state_all_india_seats: anchor.state_all_india_seats,
        program_total_seat_capacity_raw: anchor.program_total_seat_capacity_raw,
        program_total_female_supernumerary_raw: anchor.program_total_female_supernumerary_raw,
      };
      rows.push(anchor);
      if (totalsPair) i += 1;
      continue;
    }

    const female = parseFemaleOnlyLine(t, currentCtx, inst);
    if (female) {
      rows.push(female);
      continue;
    }
  }

  return rows;
}

function parseAnchorLine(line, inst, totalsPair) {
  if (!totalsPair) return null;

  const counts = extractTrailingNumbers(line, 11);
  if (!counts) return null;

  const prefix = counts.prefix;
  const nums = counts.numbers;

  const codeMatch = prefix.match(/^(\d{3,})\s+(\d{3,6})\s+(.*)$/);
  if (!codeMatch) return null;

  const instituteCode = codeMatch[1];
  const programCode = codeMatch[2];
  const rest = codeMatch[3];

  const stateScopeUpper = findBestStateScope(rest);
  if (!stateScopeUpper) return null;

  const upperRest = normalizeText(rest).toUpperCase();
  const stateIdx = upperRest.lastIndexOf(stateScopeUpper);
  if (stateIdx === -1) return null;

  const programName = normalizeText(rest.slice(0, stateIdx));
  const afterState = normalizeText(rest.slice(stateIdx + stateScopeUpper.length));
  if (!/^Gender-Neutral$/i.test(afterState)) return null;

  const rawCells = [
    instituteCode,
    inst.institute_name || null,
    programCode,
    programName,
    toTitleCaseStateScope(stateScopeUpper),
    'Gender-Neutral',
    ...nums.map(String),
    totalsPair.seatCapacity,
    totalsPair.femaleSupernumerary,
  ];

  return normalizeSeatRow({
    source: 'csab_instprofile_seat_breakup_text_v3',
    source_url: inst.profile_url,
    extracted_at: new Date().toISOString(),
    table_page: 1,
    raw_headers: HEADERS,
    raw_cells: rawCells,
  });
}

function parseFemaleOnlyLine(line, currentCtx, inst) {
  if (!currentCtx) return null;
  if (!/^Female-only( \(including Supernumerary\))?/i.test(line)) return null;

  const counts = extractTrailingNumbers(line, 11);
  if (!counts) return null;

  const seatPool = /^Female-only \(including Supernumerary\)/i.test(counts.prefix)
    ? 'Female-only (including Supernumerary)'
    : 'Female-only';

  const rawCells = [
    currentCtx.institute_code,
    currentCtx.institute_name,
    currentCtx.program_code,
    currentCtx.program_name,
    currentCtx.state_all_india_seats,
    seatPool,
    ...counts.numbers.map(String),
    currentCtx.program_total_seat_capacity_raw,
    currentCtx.program_total_female_supernumerary_raw,
  ];

  return normalizeSeatRow({
    source: 'csab_instprofile_seat_breakup_text_v3',
    source_url: inst.profile_url,
    extracted_at: new Date().toISOString(),
    table_page: 1,
    raw_headers: HEADERS,
    raw_cells: rawCells,
  });
}

function parseTotalsPairLine(line) {
  const t = normalizeText(line);
  const m = t.match(/^(\d+)\s+(\d+)$/);
  if (!m) return null;
  return { seatCapacity: m[1], femaleSupernumerary: m[2] };
}

function extractTrailingNumbers(line, expectedCount) {
  const tokens = normalizeText(line).split(' ');
  const numbers = [];

  while (tokens.length) {
    const last = tokens[tokens.length - 1];
    if (/^-?\d+$/.test(last)) {
      numbers.unshift(last);
      tokens.pop();
    } else {
      break;
    }
  }

  if (numbers.length !== expectedCount) return null;
  return { prefix: normalizeText(tokens.join(' ')), numbers };
}

function findBestStateScope(text) {
  const upper = normalizeText(text).toUpperCase();
  const candidates = [];

  for (const base of KNOWN_STATE_SCOPES) {
    if (upper.includes(base)) candidates.push(base);
    const otherThan = `OTHER THAN ${base}`;
    if (upper.includes(otherThan)) candidates.push(otherThan);
    const fromState = `FROM ${base}`;
    if (upper.includes(fromState)) candidates.push(fromState);
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function toTitleCaseStateScope(scopeUpper) {
  return scopeUpper
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/^Other Than /, 'Other Than ')
    .replace(/^All India$/, 'All India')
    .replace(/^Home State$/, 'Home State')
    .replace(/^Other State$/, 'Other State');
}

function normalizeSeatRow(row) {
  const rec = { ...row };

  for (let i = 0; i < HEADERS.length; i += 1) {
    const key = headerToKey(HEADERS[i]);
    rec[key] = row.raw_cells[i] ?? null;
  }

  const numericFields = [
    'open', 'open_pwd', 'gen_ews', 'gen_ews_pwd', 'sc', 'sc_pwd',
    'st', 'st_pwd', 'obc_ncl', 'obc_ncl_pwd',
    'total_includes_female_supernumerary',
    'program_total_seat_capacity', 'program_total_female_supernumerary',
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
    rec.open ?? '', rec.open_pwd ?? '', rec.gen_ews ?? '', rec.gen_ews_pwd ?? '',
    rec.sc ?? '', rec.sc_pwd ?? '', rec.st ?? '', rec.st_pwd ?? '',
    rec.obc_ncl ?? '', rec.obc_ncl_pwd ?? '',
    rec.total_includes_female_supernumerary ?? '',
    rec.program_total_seat_capacity ?? '', rec.program_total_female_supernumerary ?? '',
  ].join('||');

  return rec;
}

function headerToKey(label) {
  const raw = normalizeText(label);
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
  return directMap[raw] || raw.toLowerCase().replace(/\|/g, ' ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function readNdjson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
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