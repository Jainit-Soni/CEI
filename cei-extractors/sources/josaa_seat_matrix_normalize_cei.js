#!/usr/bin/env node

/**
 * JoSAA Seat Matrix -> CEI normalized NDJSON transformer
 *
 * Input:
 *   Raw seat-matrix extractor NDJSON rows shaped like:
 *   {
 *     source,
 *     source_url,
 *     extracted_at,
 *     raw_headers,
 *     raw_cells,
 *     institute_name,
 *     program_name,
 *     state_all_india_seats,
 *     seat_pool,
 *     open,
 *     open_pwd,
 *     gen_ews,
 *     gen_ews_pwd,
 *     sc,
 *     sc_pwd,
 *     st,
 *     st_pwd,
 *     obc_ncl,
 *     obc_ncl_pwd,
 *     total_includes_female_supernumerary,
 *     program_total_seat_capacity,
 *     program_total_female_supernumerary,
 *     source_row_fingerprint
 *   }
 *
 * Output:
 *   CEI-normalized NDJSON rows with canonical fields, provenance, entity keys,
 *   and consistency checks.
 *
 * Install:
 *   npm i fs-extra minimist split2
 *
 * Usage:
 *   node josaa_seat_matrix_normalize_cei.js \
 *     --in=./output/josaa_seat_matrix_all.ndjson \
 *     --out=./output/josaa_seat_matrix_all_normalized.ndjson
 *
 * Optional:
 *   --academic-year=2025-26
 *   --counselling-year=2025
 *   --dedupe=entity              // entity | fingerprint | none
 *   --keep-unknown=true          // default true
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
    rows_skipped_empty: 0,
    rows_skipped_invalid_json: 0,
    rows_skipped_unknown: 0,
    rows_skipped_duplicate: 0,
    rows_skipped_invalid_shape: 0,
    unknown_counts: {
      quota_scope_canonical: 0,
      seat_pool_canonical: 0,
      program_parse_partial: 0,
    },
    quality_counts: {
      total_mismatch_rows: 0,
      female_supernumerary_positive_rows: 0,
      program_total_missing_rows: 0,
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

          const normalized = normalizeSeatMatrixRow(raw, summary);
          if (!normalized) {
            summary.rows_skipped_invalid_shape += 1;
            return;
          }

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

function normalizeSeatMatrixRow(raw, summary) {
  const instituteNameRaw = normalizeText(raw.institute_name);
  const programNameRaw = normalizeText(raw.program_name);
  const quotaScopeRaw = normalizeText(raw.state_all_india_seats);
  const seatPoolRaw = normalizeText(raw.seat_pool);

  if (!instituteNameRaw || !programNameRaw || !quotaScopeRaw || !seatPoolRaw) {
    return null;
  }

  const parsedProgram = parseProgram(programNameRaw);
  const parsedQuotaScope = parseQuotaScope(quotaScopeRaw);
  const parsedSeatPool = parseSeatPool(seatPoolRaw);

  if (!parsedQuotaScope.canonical) summary.unknown_counts.quota_scope_canonical += 1;
  if (!parsedSeatPool.canonical) summary.unknown_counts.seat_pool_canonical += 1;
  if (parsedProgram.parseStatus !== 'parsed') summary.unknown_counts.program_parse_partial += 1;

  const seatCounts = {
    open: toNullableInt(raw.open),
    open_pwd: toNullableInt(raw.open_pwd),
    gen_ews: toNullableInt(raw.gen_ews),
    gen_ews_pwd: toNullableInt(raw.gen_ews_pwd),
    sc: toNullableInt(raw.sc),
    sc_pwd: toNullableInt(raw.sc_pwd),
    st: toNullableInt(raw.st),
    st_pwd: toNullableInt(raw.st_pwd),
    obc_ncl: toNullableInt(raw.obc_ncl),
    obc_ncl_pwd: toNullableInt(raw.obc_ncl_pwd),
  };

  const programTotalSeatCapacity = toNullableInt(raw.program_total_seat_capacity);
  const programTotalFemaleSupernumerary = toNullableInt(raw.program_total_female_supernumerary);
  const totalIncludesFemaleSupernumerary = toNullableInt(raw.total_includes_female_supernumerary);

  if (programTotalSeatCapacity == null) summary.quality_counts.program_total_missing_rows += 1;
  if ((programTotalFemaleSupernumerary || 0) > 0) summary.quality_counts.female_supernumerary_positive_rows += 1;

  const categorySum = sumNullable(Object.values(seatCounts));
  const totalMismatch =
    totalIncludesFemaleSupernumerary != null && categorySum != null
      ? totalIncludesFemaleSupernumerary !== categorySum
      : null;

  if (totalMismatch === true) {
    summary.quality_counts.total_mismatch_rows += 1;
  }

  const entityKey = buildEntityKey({
    authority: 'JOSAA',
    counsellingYear: CONFIG.counsellingYear,
    instituteNameRaw,
    programNameRaw,
    quotaScopeRaw,
    seatPoolRaw,
  });

  const sourceRowFingerprint = [
    entityKey,
    seatCounts.open ?? '',
    seatCounts.open_pwd ?? '',
    seatCounts.gen_ews ?? '',
    seatCounts.gen_ews_pwd ?? '',
    seatCounts.sc ?? '',
    seatCounts.sc_pwd ?? '',
    seatCounts.st ?? '',
    seatCounts.st_pwd ?? '',
    seatCounts.obc_ncl ?? '',
    seatCounts.obc_ncl_pwd ?? '',
    totalIncludesFemaleSupernumerary ?? '',
    programTotalSeatCapacity ?? '',
    programTotalFemaleSupernumerary ?? '',
  ].join('||');

  return {
    authority: 'JOSAA',
    source_type: 'official_seat_matrix',
    academic_year: CONFIG.academicYear,
    counselling_year: CONFIG.counsellingYear,

    institute_name_raw: instituteNameRaw,
    institute_name_normalized: instituteNameRaw,

    program_name_raw: programNameRaw,
    program_title: parsedProgram.programTitle,
    program_duration_years: parsedProgram.durationYears,
    degree_award: parsedProgram.degreeAward,
    program_parse_status: parsedProgram.parseStatus,

    quota_scope_raw: quotaScopeRaw,
    quota_scope_canonical: parsedQuotaScope.canonical,

    seat_pool_raw: seatPoolRaw,
    seat_pool_canonical: parsedSeatPool.canonical,
    is_female_only_pool: parsedSeatPool.isFemaleOnly,
    is_gender_neutral_pool: parsedSeatPool.isGenderNeutral,

    open: seatCounts.open,
    open_pwd: seatCounts.open_pwd,
    gen_ews: seatCounts.gen_ews,
    gen_ews_pwd: seatCounts.gen_ews_pwd,
    sc: seatCounts.sc,
    sc_pwd: seatCounts.sc_pwd,
    st: seatCounts.st,
    st_pwd: seatCounts.st_pwd,
    obc_ncl: seatCounts.obc_ncl,
    obc_ncl_pwd: seatCounts.obc_ncl_pwd,

    total_includes_female_supernumerary: totalIncludesFemaleSupernumerary,
    category_sum_excluding_program_totals: categorySum,
    total_mismatch_flag: totalMismatch,

    program_total_seat_capacity: programTotalSeatCapacity,
    program_total_female_supernumerary: programTotalFemaleSupernumerary,

    source_url: raw.source_url || null,
    extracted_at: raw.extracted_at || null,

    provenance: {
      source: raw.source || 'josaa_seat_matrix',
      raw_headers: Array.isArray(raw.raw_headers) ? raw.raw_headers : [],
      raw_cells: Array.isArray(raw.raw_cells) ? raw.raw_cells : [],
      table_page: toNullableInt(raw.table_page),
    },

    entity_key: entityKey,
    source_row_fingerprint: sourceRowFingerprint,
  };
}

function parseQuotaScope(value) {
  const raw = normalizeText(value);
  const upper = raw.toUpperCase();

  const map = {
    'ALL INDIA': 'ALL_INDIA',
    'HOME STATE': 'HOME_STATE',
    'OTHER STATE': 'OTHER_STATE',
    'STATE': 'STATE',
  };

  return {
    raw: raw || null,
    canonical: map[upper] || null,
  };
}

function parseSeatPool(value) {
  const raw = normalizeText(value);
  const upper = raw.toUpperCase();

  const isGenderNeutral = upper === 'GENDER-NEUTRAL';
  const isFemaleOnly = upper === 'FEMALE-ONLY (INCLUDING SUPERNUMERARY)' || upper === 'FEMALE-ONLY';

  let canonical = null;
  if (isGenderNeutral) canonical = 'GENDER_NEUTRAL';
  else if (upper === 'FEMALE-ONLY (INCLUDING SUPERNUMERARY)') canonical = 'FEMALE_ONLY_INCLUDING_SUPERNUMERARY';
  else if (upper === 'FEMALE-ONLY') canonical = 'FEMALE_ONLY';

  return {
    raw: raw || null,
    canonical,
    isGenderNeutral,
    isFemaleOnly,
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

function buildEntityKey(input) {
  return [
    input.authority,
    input.counsellingYear != null ? input.counsellingYear : '',
    canonicalKeyPart(input.instituteNameRaw),
    canonicalKeyPart(input.programNameRaw),
    canonicalKeyPart(input.quotaScopeRaw),
    canonicalKeyPart(input.seatPoolRaw),
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
  if (!row.quota_scope_raw) return true;
  if (!row.seat_pool_raw) return true;
  return false;
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

function sumNullable(values) {
  const numeric = values.filter((v) => Number.isFinite(v));
  if (!numeric.length) return null;
  return numeric.reduce((acc, n) => acc + n, 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
