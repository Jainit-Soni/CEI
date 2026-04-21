#!/usr/bin/env node

/**
 * MCC UG seat-matrix block parser (debug target: MBBS Special Stray PDF)
 *
 * Why this exists:
 * - The line-based normalizer is misclassifying quota lines as institution names.
 * - MCC seat-matrix text needs carried institution context.
 *
 * This parser:
 * - reads ONE text dump first (default: MBBS Special Stray seat matrix)
 * - walks lines sequentially
 * - tracks current state + institution header context
 * - emits seat rows only when a seat-row pattern is seen
 * - keeps raw fields + parse confidence instead of pretending full certainty
 *
 * Install:
 *   npm i fs-extra minimist
 *
 * Usage:
 *   node mcc_ug_parse_seat_matrix_blocks.js --dir=./output/mcc_ug_selected_docs
 *
 * Optional:
 *   --title-fragment="SPECIAL_STRAY"
 */

const fs = require('fs-extra');
const path = require('path');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  string: ['dir', 'title-fragment'],
  default: {
    dir: path.resolve(process.cwd(), 'output', 'mcc_ug_selected_docs'),
    'title-fragment': 'SPECIAL_STRAY__SEAT_MATRIX_UG_MBBS_SPECIAL_STRAY_ROUND_UG_2025',
  },
});

const TARGET_DIR = path.resolve(argv.dir);
const PARSED_DIR = path.join(TARGET_DIR, 'parsed_seat_matrix');
const TEXT_DIR = path.join(PARSED_DIR, 'text');
const OUTPUT_PATH = path.join(PARSED_DIR, 'mcc_ug_special_stray_block_rows.ndjson');
const META_PATH = path.join(PARSED_DIR, 'mcc_ug_special_stray_block_rows.meta.json');

const STATES = [
  'ANDAMAN AND NICOBAR ISLANDS', 'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR',
  'CHANDIGARH', 'CHHATTISGARH', 'DADRA AND NAGAR HAVELI', 'DAMAN AND DIU', 'DELHI',
  'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JAMMU AND KASHMIR', 'JHARKHAND',
  'KARNATAKA', 'KERALA', 'LADAKH', 'LAKSHADWEEP', 'MADHYA PRADESH', 'MAHARASHTRA',
  'MANIPUR', 'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'PUDUCHERRY', 'PUNJAB',
  'RAJASTHAN', 'SIKKIM', 'TAMIL NADU', 'TELANGANA', 'TRIPURA', 'UTTAR PRADESH',
  'UTTARAKHAND', 'WEST BENGAL'
];

async function main() {
  await fs.ensureDir(PARSED_DIR);
  await fs.writeFile(OUTPUT_PATH, '', 'utf8');

  const targetFile = await resolveTargetTextDump(TEXT_DIR, argv['title-fragment']);
  const text = await fs.readFile(targetFile, 'utf8');
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);

  const summary = {
    target_dir: TARGET_DIR,
    target_text_dump: targetFile,
    title_fragment: argv['title-fragment'],
    generated_at: new Date().toISOString(),
    total_lines: lines.length,
    seat_rows_emitted: 0,
    state_lines_seen: 0,
    institution_header_lines_seen: 0,
    skipped_noise_lines: 0,
    parse_confidence_counts: {},
    first_emitted_rows: [],
  };

  let currentState = null;
  let currentInstitutionHeaderRaw = null;
  let currentInstitutionNameGuess = null;
  let currentInstitutionCodeRaw = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (isNoiseLine(line)) {
      summary.skipped_noise_lines += 1;
      continue;
    }

    const detectedState = detectStateOnlyLine(line);
    if (detectedState) {
      currentState = detectedState;
      summary.state_lines_seen += 1;
      continue;
    }

    const seatRow = parseSeatRowLine(line);
    if (seatRow) {
      if (seatRow.institute_code_raw) currentInstitutionCodeRaw = seatRow.institute_code_raw;

      const emitted = {
        authority: 'MCC',
        source_type: 'official_seat_matrix_block_candidate',
        counselling_variant: 'MCC_UG',
        round_inferred: 'SPECIAL_STRAY',
        course_bucket_inferred: 'MBBS',
        document_title: 'SEAT MATRIX UG MBBS SPECIAL STRAY ROUND UG 2025',

        institution_state_raw: currentState,
        institution_code_raw: currentInstitutionCodeRaw,
        institution_header_raw: currentInstitutionHeaderRaw,
        institution_name_guess: currentInstitutionNameGuess,

        quota_raw: seatRow.quota_raw,
        course_name_raw: seatRow.course_name_raw,
        category_code_raw: seatRow.category_code_raw,
        seat_suffix_raw: seatRow.seat_suffix_raw,
        seat_count: seatRow.seat_count,

        raw_line: line,
        line_index: i,
        parse_confidence: scoreConfidence({
          currentState,
          currentInstitutionHeaderRaw,
          currentInstitutionNameGuess,
          currentInstitutionCodeRaw,
          seatRow,
        }),
      };

      emitted.entity_key = [
        'MCC',
        'MCC_UG',
        normalizeKey(emitted.round_inferred),
        normalizeKey(emitted.institution_code_raw),
        normalizeKey(emitted.institution_name_guess),
        normalizeKey(emitted.quota_raw),
        normalizeKey(emitted.course_name_raw),
        normalizeKey(emitted.category_code_raw),
        emitted.seat_count ?? '',
      ].join('||');

      emitted.source_row_fingerprint = [
        emitted.entity_key,
        normalizeKey(emitted.raw_line),
      ].join('||');

      await fs.appendFile(OUTPUT_PATH, JSON.stringify(emitted) + '\n', 'utf8');
      summary.seat_rows_emitted += 1;
      inc(summary.parse_confidence_counts, emitted.parse_confidence);
      if (summary.first_emitted_rows.length < 12) summary.first_emitted_rows.push(emitted);
      continue;
    }

    const header = parseInstitutionHeaderLine(line, currentState);
    if (header) {
      currentInstitutionHeaderRaw = header.header_raw;
      currentInstitutionNameGuess = header.institution_name_guess;
      if (header.institution_code_raw) currentInstitutionCodeRaw = header.institution_code_raw;
      summary.institution_header_lines_seen += 1;
      continue;
    }

    summary.skipped_noise_lines += 1;
  }

  await fs.writeJson(META_PATH, summary, { spaces: 2 });
  console.log('MCC UG block parse complete');
  console.log(JSON.stringify({
    target_text_dump: targetFile,
    total_lines: summary.total_lines,
    seat_rows_emitted: summary.seat_rows_emitted,
    state_lines_seen: summary.state_lines_seen,
    institution_header_lines_seen: summary.institution_header_lines_seen,
    parse_confidence_counts: summary.parse_confidence_counts,
    output_path: OUTPUT_PATH,
  }, null, 2));
}

async function resolveTargetTextDump(textDir, fragment) {
  const files = (await fs.readdir(textDir)).filter((x) => x.toLowerCase().endsWith('.txt'));
  const hit = files.find((x) => x.toUpperCase().includes(String(fragment || '').toUpperCase()));
  if (!hit) {
    throw new Error(`Could not find text dump containing fragment: ${fragment}`);
  }
  return path.join(textDir, hit);
}

function parseSeatRowLine(line) {
  const cleaned = clean(line);
  if (!cleaned) return null;

  // Extract terminal seat count first.
  const seatMatch = cleaned.match(/\s(\d+)$/);
  if (!seatMatch) return null;
  const seatCount = Number(seatMatch[1]);
  let core = clean(cleaned.slice(0, seatMatch.index));

  // Core course tokens for current debug target.
  const courseMatch = core.match(/\b(MBBS\s*\(MBBS\)|BDS\s*\(BDS\)|B\.?\s*SC\s*\(?NURSING\)?(?:\s*\([^)]*\))?)\b/i);
  if (!courseMatch) return null;

  const beforeCourse = clean(core.slice(0, courseMatch.index));
  const afterCourse = clean(core.slice(courseMatch.index + courseMatch[0].length));
  if (!afterCourse) return null;

  // Allow institute code / postal fragments at front, but remove them from quota.
  let instituteCodeRaw = null;
  const codeMatch = beforeCourse.match(/\((\d{6})\)/);
  if (codeMatch) instituteCodeRaw = codeMatch[1];

  let quotaRaw = beforeCourse
    .replace(/^\d{6}\s+/, '')
    .replace(/\(\d{6}\)/g, '')
    .replace(/^[-,\s]+|[-,\s]+$/g, '')
    .trim();

  const tail = afterCourse.match(/^([A-Z]{2,4})\s+([A-Z]{2,4})$/i);
  if (!tail) return null;

  return {
    institute_code_raw: instituteCodeRaw,
    quota_raw: quotaRaw || null,
    course_name_raw: normalizeCourseName(courseMatch[0]),
    category_code_raw: tail[1].toUpperCase(),
    seat_suffix_raw: tail[2].toUpperCase(),
    seat_count: seatCount,
  };
}

function parseInstitutionHeaderLine(line, currentState) {
  const cleaned = clean(line);
  if (!cleaned) return null;
  if (/\b(MBBS|BDS|NURSING)\b/i.test(cleaned)) return null;
  if (/\b(OP|SC|ST|EW|BC|NO)\b\s+\d+$/i.test(cleaned)) return null;

  const hasMedicalWord = /medical college|aiims|institute|hospital|university|college/i.test(cleaned);
  const hasPinOrCode = /\b\d{6}\b|\(\d{6}\)/.test(cleaned);
  if (!hasMedicalWord && !hasPinOrCode) return null;

  let headerRaw = cleaned;
  let stateRaw = currentState;

  for (const state of STATES) {
    const titleState = toTitleCase(state);
    if (cleaned.toUpperCase().startsWith(state + ' ')) {
      stateRaw = titleState;
      headerRaw = clean(cleaned.slice(state.length));
      break;
    }
  }

  const institutionCodeRaw = extractInstitutionCode(cleaned);
  const institutionNameGuess = guessInstitutionName(headerRaw);

  return {
    institution_code_raw: institutionCodeRaw,
    state_raw: stateRaw,
    header_raw: cleaned,
    institution_name_guess: institutionNameGuess,
  };
}

function detectStateOnlyLine(line) {
  const cleaned = clean(line).toUpperCase();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/&/g, 'AND').replace(/\s+/g, ' ').trim();
  for (const state of STATES) {
    if (normalized === state) return toTitleCase(state);
  }
  return null;
}

function guessInstitutionName(headerRaw) {
  const cleaned = clean(headerRaw);
  if (!cleaned) return null;

  const withoutCode = cleaned.replace(/\(\d{6}\)/g, '').trim();
  const parts = withoutCode.split(',').map(clean).filter(Boolean);
  if (!parts.length) return withoutCode || null;

  // Keep the first strong segment, optionally plus the second if it still looks like name not address.
  const first = parts[0];
  const second = parts[1] || null;
  if (!second) return first;
  if (/road|nagar|district|dist\.|pin|pincode|near|post|po\b|campus|village|taluka|tehsil|state|city/i.test(second)) {
    return first;
  }
  if (/medical college|hospital|university|aiims|institute|college/i.test(second)) {
    return `${first}, ${second}`;
  }
  return first;
}

function extractInstitutionCode(line) {
  const m = clean(line).match(/\((\d{6})\)/);
  return m ? m[1] : null;
}

function normalizeCourseName(value) {
  const t = clean(value).toUpperCase();
  if (t.includes('MBBS')) return 'MBBS';
  if (t.includes('BDS')) return 'BDS';
  if (t.includes('NURSING')) return 'BSC_NURSING';
  return clean(value);
}

function isNoiseLine(line) {
  const t = clean(line).toLowerCase();
  if (!t) return true;
  const patterns = [
    /^page \d+/,
    /^medical counselling committee/,
    /^directorate general of health services/,
    /^ministry of health/,
    /^government of india/,
    /^seat matrix$/,
    /^ug counselling$/,
    /^neet ug counselling$/,
    /^institute$/, /^quota$/, /^course$/, /^seat$/,
  ];
  if (patterns.some((rx) => rx.test(t))) return true;
  return false;
}

function scoreConfidence(ctx) {
  let score = 0;
  if (ctx.seatRow.seat_count != null) score += 25;
  if (ctx.seatRow.course_name_raw) score += 20;
  if (ctx.seatRow.quota_raw) score += 15;
  if (ctx.currentInstitutionNameGuess) score += 25;
  if (ctx.currentInstitutionCodeRaw) score += 10;
  if (ctx.currentState) score += 5;
  if (score >= 85) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return clean(value).toLowerCase();
}

function toTitleCase(value) {
  return String(value || '')
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/And/g, 'and');
}

function inc(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
