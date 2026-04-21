#!/usr/bin/env node

/**
 * MCC UG seat-matrix candidate normalizer (v1)
 *
 * Goal:
 * - Read row-like candidate lines extracted from MCC UG seat-matrix PDFs
 * - Convert them into conservative, structured CEI rows when possible
 * - Preserve uncertainty instead of faking precision
 *
 * Important:
 * - This is a heuristic normalizer, not a perfect table parser
 * - v1 prefers partial-but-usable structured rows over brittle full parsing
 * - Every output row keeps raw provenance and parse confidence
 *
 * Input:
 *   ./output/mcc_ug_selected_docs/parsed_seat_matrix/seat_matrix_row_candidates.ndjson
 *
 * Output:
 *   ./output/mcc_ug_selected_docs/parsed_seat_matrix/mcc_ug_seat_matrix_normalized.ndjson
 *
 * Install:
 *   npm i fs-extra minimist split2
 *
 * Usage:
 *   node mcc_ug_normalize_seat_matrix_candidates.js --dir=./output/mcc_ug_selected_docs
 */

const fs = require('fs-extra');
const path = require('path');
const split2 = require('split2');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  string: ['dir'],
  default: {
    dir: path.resolve(process.cwd(), 'output', 'mcc_ug_selected_docs'),
  },
});

const TARGET_DIR = path.resolve(argv.dir);
const PARSED_DIR = path.join(TARGET_DIR, 'parsed_seat_matrix');
const INPUT_PATH = path.join(PARSED_DIR, 'seat_matrix_row_candidates.ndjson');
const OUTPUT_PATH = path.join(PARSED_DIR, 'mcc_ug_seat_matrix_normalized.ndjson');
const META_PATH = path.join(PARSED_DIR, 'mcc_ug_seat_matrix_normalized.meta.json');

const COURSE_PATTERNS = [
  { canonical: 'MBBS', rx: /\bMBBS\b/i },
  { canonical: 'BDS', rx: /\bBDS\b/i },
  { canonical: /BSC_NURSING/i, rx: /\bB\.?\s*SC\s*\(?NURSING\)?\b|\bBSC\s+NURSING\b|\bNURSING\b/i },
];

const CATEGORY_PATTERNS = [
  { canonical: 'OPEN', rx: /\bOPEN\b/i },
  { canonical: 'GEN', rx: /\bGEN(?:ERAL)?\b|\bUR\b/i },
  { canonical: 'GEN_EWS', rx: /\bEWS\b|\bGEN\s*[- ]?EWS\b/i },
  { canonical: 'OBC_NCL', rx: /\bOBC\b|\bOBC[- ]?NCL\b/i },
  { canonical: 'SC', rx: /\bSC\b/i },
  { canonical: 'ST', rx: /\bST\b/i },
  { canonical: 'PWD', rx: /\bPWD\b|\bPWD\b|\bPH\b/i },
  { canonical: 'EWD', rx: /\bEWD\b/i },
  { canonical: 'MINORITY', rx: /\bMINORITY\b/i },
  { canonical: 'NRI', rx: /\bNRI\b/i },
  { canonical: 'MANAGEMENT', rx: /\bMANAGEMENT\b/i },
];

const QUOTA_PATTERNS = [
  { canonical: 'ALL_INDIA', rx: /\bALL\s+INDIA\b|\bAIQ\b/i },
  { canonical: 'STATE', rx: /\bSTATE\b/i },
  { canonical: 'INTERNAL', rx: /\bINTERNAL\b/i },
  { canonical: 'ESIC_IP', rx: /\bESIC\b|\bIP\b/i },
  { canonical: 'DEEMED', rx: /\bDEEMED\b/i },
  { canonical: 'CENTRAL_UNIVERSITY', rx: /\bCENTRAL\s+UNIVERSITY\b/i },
  { canonical: 'AFMS', rx: /\bAFMS\b|\bARMED\s+FORCES\b/i },
  { canonical: 'NRI', rx: /\bNRI\b/i },
  { canonical: 'MCC_MISC', rx: /\bMCC\b/i },
];

async function main() {
  if (!(await fs.pathExists(INPUT_PATH))) {
    throw new Error(`Missing ${INPUT_PATH}`);
  }

  await fs.writeFile(OUTPUT_PATH, '', 'utf8');

  const summary = {
    input_path: INPUT_PATH,
    output_path: OUTPUT_PATH,
    started_at: new Date().toISOString(),
    rows_read: 0,
    rows_written: 0,
    rows_skipped_empty: 0,
    rows_skipped_invalid_json: 0,
    rows_skipped_non_rowlike: 0,
    rows_skipped_no_seat_count: 0,
    deduped_rows: 0,
    parse_status_counts: {},
    course_bucket_counts: {},
    round_counts: {},
    confidence_band_counts: {},
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
          } catch {
            summary.rows_skipped_invalid_json += 1;
            return;
          }

          const normalized = normalizeCandidate(raw);
          if (!normalized) {
            summary.rows_skipped_non_rowlike += 1;
            return;
          }

          if (normalized.seat_count == null) {
            summary.rows_skipped_no_seat_count += 1;
            return;
          }

          if (seen.has(normalized.source_row_fingerprint)) {
            summary.deduped_rows += 1;
            return;
          }
          seen.add(normalized.source_row_fingerprint);

          writeStream.write(JSON.stringify(normalized) + '\n');
          summary.rows_written += 1;
          inc(summary.parse_status_counts, normalized.parse_status || 'unknown');
          inc(summary.course_bucket_counts, normalized.course_bucket_inferred || 'unknown');
          inc(summary.round_counts, String(normalized.round_inferred ?? 'unknown'));
          inc(summary.confidence_band_counts, normalized.confidence_band || 'unknown');
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

  console.log('MCC UG seat-matrix normalization complete');
  console.log(JSON.stringify(summary, null, 2));
}

function normalizeCandidate(raw) {
  const rawLine = normalizeText(raw.raw_line);
  if (!rawLine) return null;

  if (shouldSkipCandidate(raw)) return null;

  const seatCount = extractSeatCount(rawLine);
  const numericCount = countNumbers(rawLine);
  const course = detectCourse(rawLine, raw.course_bucket_inferred);
  const quota = detectPattern(rawLine, QUOTA_PATTERNS);
  const category = detectPattern(rawLine, CATEGORY_PATTERNS);

  const stripped = stripTerminalSeatCount(rawLine);
  const split = splitInstitutionAndCourse(stripped, course.raw_match);
  const institutionNameRaw = split.institution_name_raw;
  const courseNameRaw = split.course_name_raw;

  const parseStatus = decideParseStatus({
    institutionNameRaw,
    courseNameRaw,
    seatCount,
    courseCanonical: course.canonical,
    numericCount,
  });

  const confidenceScore = scoreConfidence({
    institutionNameRaw,
    courseNameRaw,
    seatCount,
    courseCanonical: course.canonical,
    quotaCanonical: quota.canonical,
    categoryCanonical: category.canonical,
    numericCount,
    candidateType: raw.candidate_type,
  });

  const confidenceBand =
    confidenceScore >= 80 ? 'high' :
    confidenceScore >= 55 ? 'medium' :
    'low';

  const entityKey = [
    'MCC',
    'MCC_UG',
    normalizeKeyPart(raw.round_inferred),
    normalizeKeyPart(raw.course_bucket_inferred),
    normalizeKeyPart(institutionNameRaw),
    normalizeKeyPart(courseNameRaw || course.canonical),
    normalizeKeyPart(quota.raw),
    normalizeKeyPart(category.raw),
    seatCount ?? '',
  ].join('||');

  return {
    authority: 'MCC',
    source_type: 'official_seat_matrix_candidate',
    counselling_variant: 'MCC_UG',

    round_inferred: normalizeRound(raw.round_inferred),
    course_bucket_inferred: raw.course_bucket_inferred || null,
    document_title: raw.document_title || null,

    institution_name_raw: institutionNameRaw,
    course_name_raw: courseNameRaw,
    course_canonical: course.canonical,

    quota_raw: quota.raw,
    quota_canonical: quota.canonical,

    category_raw: category.raw,
    category_canonical: category.canonical,

    seat_count: seatCount,

    parse_status: parseStatus,
    confidence_score: confidenceScore,
    confidence_band: confidenceBand,

    candidate_type: raw.candidate_type || null,
    numeric_token_count: toNullableInt(raw.numeric_token_count),

    source_url: raw.source_url || null,
    file_path: raw.file_path || null,
    extracted_at: raw.extracted_at || null,

    provenance: {
      raw_line: rawLine,
      previous_line: normalizeText(raw.previous_line) || null,
      next_line: normalizeText(raw.next_line) || null,
      line_index: toNullableInt(raw.line_index),
    },

    entity_key: entityKey,
    source_row_fingerprint: [
      entityKey,
      normalizeKeyPart(rawLine),
    ].join('||'),
  };
}

function shouldSkipCandidate(raw) {
  const line = normalizeText(raw.raw_line).toLowerCase();
  if (!line) return true;
  if (raw.candidate_type === 'total_like') return true;
  if (/^total\b/.test(line)) return true;
  if (/grand total/i.test(line)) return true;
  if (/^quota\b|^category\b|^seat\b/.test(line)) return true;
  return false;
}

function extractSeatCount(line) {
  const matches = normalizeText(line).match(/\b\d+\b/g) || [];
  if (!matches.length) return null;
  const last = matches[matches.length - 1];
  return Number(last);
}

function stripTerminalSeatCount(line) {
  return normalizeText(line).replace(/\s+\d+\s*$/, '').trim();
}

function countNumbers(line) {
  return (normalizeText(line).match(/\b\d+\b/g) || []).length;
}

function detectCourse(line, fallbackBucket) {
  for (const item of COURSE_PATTERNS) {
    const match = normalizeText(line).match(item.rx);
    if (match) {
      return {
        canonical: typeof item.canonical === 'string' ? item.canonical : 'BSC_NURSING',
        raw_match: match[0],
      };
    }
  }

  const bucket = String(fallbackBucket || '').toUpperCase();
  if (bucket.includes('MBBS')) return { canonical: 'MBBS', raw_match: null };
  if (bucket.includes('BDS')) return { canonical: 'BDS', raw_match: null };
  if (bucket.includes('NURSING')) return { canonical: 'BSC_NURSING', raw_match: null };

  return { canonical: null, raw_match: null };
}

function detectPattern(line, patterns) {
  for (const item of patterns) {
    const match = normalizeText(line).match(item.rx);
    if (match) {
      return { canonical: item.canonical, raw: normalizeText(match[0]) || null };
    }
  }
  return { canonical: null, raw: null };
}

function splitInstitutionAndCourse(line, rawCourseMatch) {
  const clean = normalizeText(line);
  if (!clean) {
    return { institution_name_raw: null, course_name_raw: null };
  }

  const courseRegex = /(MBBS|BDS|B\.?\s*SC\s*\(?NURSING\)?|BSC\s+NURSING|NURSING)/i;
  const match = clean.match(courseRegex);

  if (!match) {
    return {
      institution_name_raw: clean,
      course_name_raw: null,
    };
  }

  const idx = match.index;
  const institution = normalizeText(clean.slice(0, idx)) || null;
  const coursePart = normalizeText(clean.slice(idx)) || rawCourseMatch || null;

  return {
    institution_name_raw: institution,
    course_name_raw: coursePart,
  };
}

function decideParseStatus(input) {
  if (input.institutionNameRaw && input.courseNameRaw && input.seatCount != null) return 'structured_partial';
  if (input.courseCanonical && input.seatCount != null) return 'course_and_count_only';
  if (input.seatCount != null) return 'count_only';
  return 'unparsed';
}

function scoreConfidence(input) {
  let score = 0;
  if (input.seatCount != null) score += 25;
  if (input.courseCanonical) score += 20;
  if (input.courseNameRaw) score += 15;
  if (input.institutionNameRaw) score += 20;
  if (input.quotaCanonical) score += 8;
  if (input.categoryCanonical) score += 8;
  if (input.numericCount >= 2 && input.numericCount <= 8) score += 4;
  if (input.candidateType === 'course_row_like') score += 8;
  if (input.candidateType === 'quota_row_like') score += 5;
  return Math.min(score, 100);
}

function normalizeRound(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.toUpperCase();
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeKeyPart(value) {
  return normalizeText(value).toLowerCase();
}

function toNullableInt(value) {
  if (value == null) return null;
  const match = String(value).match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

function inc(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
