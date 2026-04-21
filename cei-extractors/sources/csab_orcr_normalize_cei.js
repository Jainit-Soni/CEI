#!/usr/bin/env node

/**
 * CSAB ORCR -> CEI normalized NDJSON transformer
 *
 * Input:
 *   Raw CSAB ORCR rows from csab_orcr_all_rounds_extract.js
 *
 * Output:
 *   CEI-normalized ORCR rows with canonical fields, provenance, entity keys,
 *   and rank parsing.
 *
 * Install:
 *   npm i fs-extra minimist split2
 *
 * Usage:
 *   node csab_orcr_normalize_cei.js \
 *     --in=./output/csab_orcr_all_rounds.ndjson \
 *     --out=./output/csab_orcr_all_rounds_normalized.ndjson
 *
 * Optional:
 *   --academic-year=2025-26
 *   --counselling-year=2025
 *   --dedupe=entity              // entity | fingerprint | none
 */

const fs = require('fs-extra');
const path = require('path');
const split2 = require('split2');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  string: ['in', 'out', 'academic-year', 'counselling-year', 'dedupe'],
  default: {
    dedupe: 'fingerprint',
    'academic-year': '2025-26',
    'counselling-year': '2025',
  },
});

const INPUT_PATH = argv.in ? path.resolve(argv.in) : null;
const OUTPUT_PATH = argv.out ? path.resolve(argv.out) : null;
const META_PATH = OUTPUT_PATH
  ? path.join(path.dirname(OUTPUT_PATH), path.basename(OUTPUT_PATH, path.extname(OUTPUT_PATH)) + '.meta.json')
  : null;

if (!INPUT_PATH || !OUTPUT_PATH) {
  console.error('Missing required args. Use --in=... --out=...');
  process.exit(1);
}

const CONFIG = {
  academicYear: String(argv['academic-year'] || '2025-26'),
  counsellingYear: toNullableInt(argv['counselling-year']),
  dedupeMode: String(argv.dedupe || 'fingerprint').toLowerCase(),
};

async function main() {
  await fs.ensureDir(path.dirname(OUTPUT_PATH));
  await fs.writeFile(OUTPUT_PATH, '', 'utf8');

  const summary = {
    input: INPUT_PATH,
    output: OUTPUT_PATH,
    started_at: new Date().toISOString(),
    academic_year: CONFIG.academicYear,
    counselling_year: CONFIG.counsellingYear,
    dedupe_mode: CONFIG.dedupeMode,
    rows_read: 0,
    rows_written: 0,
    rows_skipped_empty: 0,
    rows_skipped_invalid_json: 0,
    rows_skipped_invalid_shape: 0,
    rows_skipped_duplicate: 0,
    rounds_seen: [],
    quality_counts: {
      opening_gt_closing: 0,
      preparatory_rows: 0,
      missing_opening_rank: 0,
      missing_closing_rank: 0,
    },
  };

  const roundsSeen = new Set();
  const seen = new Set();
  const readStream = fs.createReadStream(INPUT_PATH, 'utf8');
  const writeStream = fs.createWriteStream(OUTPUT_PATH, { encoding: 'utf8' });

  await new Promise((resolve, reject) => {
    readStream
      .pipe(split2())
      .on('data', (line) => {
        try {
          const text = String(line || '').trim();
          if (!text) {
            summary.rows_skipped_empty += 1;
            return;
          }

          summary.rows_read += 1;

          let raw;
          try {
            raw = JSON.parse(text);
          } catch {
            summary.rows_skipped_invalid_json += 1;
            return;
          }

          const normalized = normalizeOrcrRow(raw, summary);
          if (!normalized) {
            summary.rows_skipped_invalid_shape += 1;
            return;
          }

          if (normalized.special_round != null) roundsSeen.add(normalized.special_round);

          const dedupeKey = getDedupeKey(normalized, CONFIG.dedupeMode);
          if (dedupeKey && seen.has(dedupeKey)) {
            summary.rows_skipped_duplicate += 1;
            return;
          }
          if (dedupeKey) seen.add(dedupeKey);

          writeStream.write(JSON.stringify(normalized) + '\n');
          summary.rows_written += 1;
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject)
      .on('end', resolve);
  });

  await new Promise((resolve, reject) => {
    writeStream.end((error) => (error ? reject(error) : resolve()));
  });

  summary.rounds_seen = Array.from(roundsSeen).sort((a, b) => a - b);
  summary.finished_at = new Date().toISOString();
  await fs.writeJson(META_PATH, summary, { spaces: 2 });

  console.log('Normalization complete');
  console.log(JSON.stringify(summary, null, 2));
}

function normalizeOrcrRow(raw, summary) {
  const instituteRaw = normalizeText(raw.institute);
  const programRaw = normalizeText(raw.academic_program_name);
  const quotaRaw = normalizeText(raw.quota);
  const seatTypeRaw = normalizeText(raw.seat_type);
  const genderRaw = normalizeText(raw.gender);
  const specialRound = toNullableInt(raw.special_round);

  if (!instituteRaw || !programRaw || !quotaRaw || !seatTypeRaw || !genderRaw || specialRound == null) {
    return null;
  }

  const parsedProgram = parseProgram(programRaw);
  const parsedQuota = parseQuota(quotaRaw);
  const parsedSeatType = parseSeatType(seatTypeRaw);
  const parsedGender = parseGender(genderRaw);
  const opening = parseRank(raw.opening_rank_raw ?? raw.opening_rank);
  const closing = parseRank(raw.closing_rank_raw ?? raw.closing_rank);

  if (opening.preparatory || closing.preparatory) {
    summary.quality_counts.preparatory_rows += 1;
  }
  if (opening.numeric == null) summary.quality_counts.missing_opening_rank += 1;
  if (closing.numeric == null) summary.quality_counts.missing_closing_rank += 1;
  if (opening.numeric != null && closing.numeric != null && opening.numeric > closing.numeric) {
    summary.quality_counts.opening_gt_closing += 1;
  }

  const entityKey = [
    'CSAB',
    'CSAB_SPECIAL',
    CONFIG.counsellingYear != null ? CONFIG.counsellingYear : '',
    specialRound,
    canonicalKeyPart(instituteRaw),
    canonicalKeyPart(programRaw),
    canonicalKeyPart(quotaRaw),
    canonicalKeyPart(seatTypeRaw),
    canonicalKeyPart(genderRaw),
  ].join('||');

  const sourceRowFingerprint = [
    entityKey,
    opening.raw || '',
    closing.raw || '',
  ].join('||');

  return {
    authority: 'CSAB',
    source_type: 'official_counselling_orcr',
    counselling_variant: 'CSAB_SPECIAL',
    academic_year: CONFIG.academicYear,
    counselling_year: CONFIG.counsellingYear,
    special_round: specialRound,

    institute_name_raw: instituteRaw,
    academic_program_name_raw: programRaw,
    program_title: parsedProgram.programTitle,
    program_duration_years: parsedProgram.durationYears,
    degree_award: parsedProgram.degreeAward,
    program_parse_status: parsedProgram.parseStatus,

    quota_raw: quotaRaw,
    quota_canonical: parsedQuota.canonical,

    seat_type_raw: seatTypeRaw,
    seat_type_canonical: parsedSeatType.canonical,

    gender_raw: genderRaw,
    gender_canonical: parsedGender.canonical,

    rank_basis: 'ALL_INDIA_CRL',
    opening_rank_raw: opening.raw,
    opening_rank: opening.numeric,
    opening_rank_preparatory: opening.preparatory,
    closing_rank_raw: closing.raw,
    closing_rank: closing.numeric,
    closing_rank_preparatory: closing.preparatory,
    opening_closing_inversion_flag:
      opening.numeric != null && closing.numeric != null ? opening.numeric > closing.numeric : null,

    source_url: raw.source_url || null,
    extracted_at: raw.extracted_at || null,

    provenance: {
      source: raw.source || 'csab_orcr',
      raw_headers: Array.isArray(raw.raw_headers) ? raw.raw_headers : [],
      raw_cells: Array.isArray(raw.raw_cells) ? raw.raw_cells : [],
      table_page: toNullableInt(raw.table_page),
    },

    entity_key: entityKey,
    source_row_fingerprint: sourceRowFingerprint,
  };
}

function parseProgram(value) {
  const raw = normalizeText(value);
  if (!raw) {
    return {
      raw: null,
      programTitle: null,
      durationYears: null,
      degreeAward: null,
      parseStatus: 'missing',
    };
  }

  const match = raw.match(/^(.*?)\s*\((\d+)\s+Years?,\s*(.*?)\)$/i);
  if (!match) {
    return {
      raw,
      programTitle: raw,
      durationYears: null,
      degreeAward: null,
      parseStatus: 'partial',
    };
  }

  return {
    raw,
    programTitle: normalizeText(match[1]) || null,
    durationYears: toNullableInt(match[2]),
    degreeAward: normalizeText(match[3]) || null,
    parseStatus: 'parsed',
  };
}

function parseQuota(value) {
  const raw = normalizeText(value);
  const upper = raw.toUpperCase();
  const map = {
    'ALL INDIA': 'ALL_INDIA',
    'HOME STATE': 'HOME_STATE',
    'OTHER STATE': 'OTHER_STATE',
    'STATE': 'STATE',
  };
  return { raw, canonical: map[upper] || null };
}

function parseSeatType(value) {
  const raw = normalizeText(value);
  const upper = raw.toUpperCase();
  const map = {
    'OPEN': 'OPEN',
    'OPEN-PWD': 'OPEN_PWD',
    'GEN-EWS': 'GEN_EWS',
    'GEN-EWS-PWD': 'GEN_EWS_PWD',
    'SC': 'SC',
    'SC-PWD': 'SC_PWD',
    'ST': 'ST',
    'ST-PWD': 'ST_PWD',
    'OBC-NCL': 'OBC_NCL',
    'OBC-NCL-PWD': 'OBC_NCL_PWD',
  };
  return { raw, canonical: map[upper] || null };
}

function parseGender(value) {
  const raw = normalizeText(value);
  const upper = raw.toUpperCase();
  const map = {
    'GENDER-NEUTRAL': 'GENDER_NEUTRAL',
    'FEMALE-ONLY': 'FEMALE_ONLY',
    'FEMALE-ONLY (INCLUDING SUPERNUMERARY)': 'FEMALE_ONLY_INCLUDING_SUPERNUMERARY',
  };
  return { raw, canonical: map[upper] || null };
}

function parseRank(value) {
  const raw = normalizeText(value);
  if (!raw) return { raw: null, numeric: null, preparatory: false };
  const preparatory = /P$/i.test(raw);
  const clean = raw.replace(/P$/i, '').replace(/,/g, '').trim();
  const numeric = /^\d+$/.test(clean) ? Number(clean) : null;
  return { raw, numeric, preparatory };
}

function getDedupeKey(row, mode) {
  if (mode === 'none') return null;
  if (mode === 'entity') return row.entity_key || null;
  return row.source_row_fingerprint || null;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function canonicalKeyPart(value) {
  return normalizeText(value).toLowerCase();
}

function toNullableInt(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});