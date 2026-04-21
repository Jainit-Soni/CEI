#!/usr/bin/env node

/**
 * JoSAA OR-CR -> CEI normalized NDJSON transformer
 *
 * Reads extractor output rows like:
 *   { source, source_url, extracted_at, round, raw_headers, raw_cells, ... }
 *
 * Writes CEI-normalized rows like:
 *   {
 *     authority,
 *     source_type,
 *     academic_year,
 *     counselling_year,
 *     round_number,
 *     institute_name_raw,
 *     program_name_raw,
 *     quota_code,
 *     quota_canonical,
 *     local_category_label,
 *     canonical_category_label,
 *     is_pwd,
 *     gender_pool_raw,
 *     gender_pool_canonical,
 *     rank_basis,
 *     opening_rank,
 *     closing_rank,
 *     entity_key,
 *     source_row_fingerprint,
 *     provenance
 *   }
 *
 * Usage:
 *   node josaa_orcr_normalize_cei.js \
 *     --in=./output/josaa_orcr_all6.ndjson \
 *     --out=./output/josaa_orcr_all6_normalized.ndjson
 *
 * Optional:
 *   --academic-year=2025-26
 *   --counselling-year=2025
 *   --dedupe=entity              // entity | fingerprint | none
 *   --keep-unknown=true          // keep rows even if some canonical fields are null
 *
 * Install:
 *   npm i fs-extra minimist split2
 */

const fs = require('fs-extra');
const path = require('path');
const split2 = require('split2');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  string: ['in', 'out', 'academic-year', 'counselling-year', 'dedupe', 'keep-unknown'],
  default: {
    dedupe: 'fingerprint',
    'academic-year': '2025-26',
    'counselling-year': '2025',
    'keep-unknown': 'true',
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
  keepUnknown: String(argv['keep-unknown']).toLowerCase() !== 'false',
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
    keep_unknown: CONFIG.keepUnknown,
    rows_read: 0,
    rows_written: 0,
    rows_skipped_invalid_json: 0,
    rows_skipped_empty: 0,
    rows_skipped_unknown: 0,
    rows_skipped_duplicate: 0,
    unknown_counts: {
      quota_canonical: 0,
      canonical_category_label: 0,
      gender_pool_canonical: 0,
      rank_basis: 0,
      program_parse_partial: 0,
    },
  };

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
          } catch (error) {
            summary.rows_skipped_invalid_json += 1;
            return;
          }

          const normalized = normalizeJosaaOrcrRow(raw, summary);

          if (!CONFIG.keepUnknown && shouldSkipBecauseTooUnknown(normalized)) {
            summary.rows_skipped_unknown += 1;
            return;
          }

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

  summary.finished_at = new Date().toISOString();
  await fs.writeJson(META_PATH, summary, { spaces: 2 });

  console.log('Normalization complete');
  console.log(JSON.stringify(summary, null, 2));
}

function normalizeJosaaOrcrRow(raw, summary) {
  const instituteNameRaw = normalizeText(raw.institute_name || raw.institute);
  const programNameRaw = normalizeText(raw.academic_program_name || raw.academic_program);
  const quotaCodeRaw = normalizeText(raw.quota);
  const seatTypeRaw = normalizeText(raw.seat_type || raw.local_category_label);
  const genderRaw = normalizeText(raw.gender || raw.gender_pool_raw);
  const roundNumber = toNullableInt(raw.round);

  const parsedProgram = parseProgram(programNameRaw);
  const parsedQuota = parseQuota(quotaCodeRaw);
  const parsedSeatType = parseSeatType(seatTypeRaw);
  const parsedGender = parseGenderPool(genderRaw);
  const opening = parseRank(raw.opening_rank_raw || raw.opening_rank);
  const closing = parseRank(raw.closing_rank_raw || raw.closing_rank);
  const rankBasis = deriveRankBasis(parsedSeatType);

  if (!parsedQuota.canonical) summary.unknown_counts.quota_canonical += 1;
  if (!parsedSeatType.categoryCanonical) summary.unknown_counts.canonical_category_label += 1;
  if (!parsedGender.canonical) summary.unknown_counts.gender_pool_canonical += 1;
  if (!rankBasis) summary.unknown_counts.rank_basis += 1;
  if (parsedProgram.parseStatus !== 'parsed') summary.unknown_counts.program_parse_partial += 1;

  const entityKey = buildEntityKey({
    authority: 'JOSAA',
    counsellingYear: CONFIG.counsellingYear,
    roundNumber,
    instituteNameRaw,
    programNameRaw,
    quotaCodeRaw,
    seatTypeRaw,
    genderRaw,
  });

  const sourceRowFingerprint = [
    entityKey,
    opening.raw || '',
    closing.raw || '',
  ].join('||');

  return {
    authority: 'JOSAA',
    source_type: 'official_counselling_orcr',
    academic_year: CONFIG.academicYear,
    counselling_year: CONFIG.counsellingYear,

    round_number: roundNumber,
    round_label: roundNumber != null ? `Round ${roundNumber}` : null,

    institute_name_raw: instituteNameRaw || null,
    institute_name_normalized: instituteNameRaw || null,

    program_name_raw: programNameRaw || null,
    program_title: parsedProgram.programTitle,
    program_duration_years: parsedProgram.durationYears,
    degree_award: parsedProgram.degreeAward,
    program_parse_status: parsedProgram.parseStatus,

    quota_code: quotaCodeRaw || null,
    quota_canonical: parsedQuota.canonical,

    local_category_label: seatTypeRaw || null,
    canonical_category_label: parsedSeatType.categoryCanonical,
    is_pwd: parsedSeatType.isPwd,

    gender_pool_raw: genderRaw || null,
    gender_pool_canonical: parsedGender.canonical,

    rank_basis: rankBasis,

    opening_rank_raw: opening.raw,
    opening_rank: opening.numeric,
    opening_rank_preparatory: opening.preparatory,

    closing_rank_raw: closing.raw,
    closing_rank: closing.numeric,
    closing_rank_preparatory: closing.preparatory,

    source_url: raw.source_url || null,
    extracted_at: raw.extracted_at || null,

    provenance: {
      source: raw.source || 'josaa_orcr',
      raw_headers: Array.isArray(raw.raw_headers) ? raw.raw_headers : [],
      raw_cells: Array.isArray(raw.raw_cells) ? raw.raw_cells : [],
    },

    entity_key: entityKey,
    source_row_fingerprint: sourceRowFingerprint,
  };
}

function buildEntityKey(input) {
  return [
    input.authority,
    input.counsellingYear != null ? input.counsellingYear : '',
    input.roundNumber != null ? input.roundNumber : '',
    canonicalKeyPart(input.instituteNameRaw),
    canonicalKeyPart(input.programNameRaw),
    canonicalKeyPart(input.quotaCodeRaw),
    canonicalKeyPart(input.seatTypeRaw),
    canonicalKeyPart(input.genderRaw),
  ].join('||');
}

function getDedupeKey(row, mode) {
  if (mode === 'none') return null;
  if (mode === 'entity') return row.entity_key || null;
  return row.source_row_fingerprint || null;
}

function shouldSkipBecauseTooUnknown(row) {
  if (!row.institute_name_raw) return true;
  if (!row.program_name_raw) return true;
  if (row.round_number == null) return true;
  if (row.opening_rank == null && row.closing_rank == null) return true;
  return false;
}

function parseQuota(value) {
  const raw = normalizeText(value).toUpperCase();
  const map = {
    AI: 'ALL_INDIA',
    HS: 'HOME_STATE',
    OS: 'OTHER_STATE',
    GO: 'GOVERNMENT_QUOTA',
    JK: 'JAMMU_KASHMIR',
    LA: 'LADAKH',
  };

  return {
    raw: raw || null,
    canonical: map[raw] || null,
  };
}

function parseSeatType(value) {
  const raw = normalizeText(value);
  const upper = raw.toUpperCase();
  const isPwd = upper.includes('PWD');

  let categoryCanonical = null;

  if (upper === 'OPEN' || upper.startsWith('OPEN ')) categoryCanonical = 'OPEN';
  else if (upper === 'EWS' || upper.includes('GEN-EWS')) categoryCanonical = 'EWS';
  else if (upper.includes('OBC-NCL')) categoryCanonical = 'OBC_NCL';
  else if (upper.startsWith('SC')) categoryCanonical = 'SC';
  else if (upper.startsWith('ST')) categoryCanonical = 'ST';

  return {
    raw: raw || null,
    categoryCanonical,
    isPwd,
  };
}

function parseGenderPool(value) {
  const raw = normalizeText(value);
  const map = {
    'GENDER-NEUTRAL': 'GENDER_NEUTRAL',
    'FEMALE-ONLY': 'FEMALE_ONLY',
    'FEMALE-ONLY (INCLUDING SUPERNUMERARY)': 'FEMALE_ONLY_INCLUDING_SUPERNUMERARY',
  };

  const upper = raw.toUpperCase();
  return {
    raw: raw || null,
    canonical: map[upper] || null,
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

function parseRank(value) {
  const raw = normalizeText(value);
  if (!raw) {
    return { raw: null, numeric: null, preparatory: false };
  }

  const preparatory = /P$/i.test(raw);
  const clean = raw.replace(/P$/i, '').replace(/,/g, '').trim();
  const numeric = /^\d+$/.test(clean) ? Number(clean) : null;

  return {
    raw,
    numeric,
    preparatory,
  };
}

function deriveRankBasis(parsedSeatType) {
  if (!parsedSeatType) return null;
  if (parsedSeatType.isPwd) return 'PWD_WITHIN_CATEGORY';
  if (parsedSeatType.categoryCanonical === 'OPEN') return 'CRL';
  if (parsedSeatType.categoryCanonical) return 'CATEGORY_RANK';
  return null;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function canonicalKeyPart(value) {
  return normalizeText(value).toLowerCase();
}

function toNullableInt(value) {
  const n = Number(String(value == null ? '' : value).trim());
  return Number.isFinite(n) ? n : null;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
