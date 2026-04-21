#!/usr/bin/env node

/**
 * MCC UG seat-matrix block parser v5
 *
 * Target:
 * - Special Stray MBBS text dump first
 *
 * Fixes vs v4:
 * - Removes table-header contamination from buffered header context
 * - Rejects generic institution-name junk more aggressively
 * - Recovers real institution names from multi-part buffered headers
 * - Keeps quota clean and separate from address text
 *
 * Usage:
 *   node mcc_ug_parse_seat_matrix_blocks_v5.js --dir=./output/mcc_ug_selected_docs
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
const OUTPUT_PATH = path.join(PARSED_DIR, 'mcc_ug_special_stray_block_rows_v5.ndjson');
const META_PATH = path.join(PARSED_DIR, 'mcc_ug_special_stray_block_rows_v5.meta.json');

const STATES = [
  'ANDAMAN AND NICOBAR ISLANDS', 'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR',
  'CHANDIGARH', 'CHHATTISGARH', 'DADRA AND NAGAR HAVELI', 'DAMAN AND DIU', 'DELHI',
  'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JAMMU AND KASHMIR', 'JHARKHAND',
  'KARNATAKA', 'KERALA', 'LADAKH', 'LAKSHADWEEP', 'MADHYA PRADESH', 'MAHARASHTRA',
  'MANIPUR', 'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'PUDUCHERRY', 'PUNJAB',
  'RAJASTHAN', 'SIKKIM', 'TAMIL NADU', 'TELANGANA', 'TRIPURA', 'UTTAR PRADESH',
  'UTTARAKHAND', 'WEST BENGAL'
];

const QUOTA_PATTERNS = [
  'Deemed/Paid Seats Quota',
  'Non-Resident Indian',
  'Employees State Insurance Scheme(ESI)',
  'Open Seat Quota',
  'All India',
  'State Quota',
  'Internal Quota',
  'NRI Quota',
];

const HEADER_NOISE_PATTERNS = [
  /^StateName\s+Institute\s+Quota\s+Branch\s+Category\s+TotalSeats$/i,
  /StateName/i,
  /Institute\s+Quota/i,
  /Branch\s+Category/i,
  /TotalSeats/i,
];

async function main() {
  await fs.ensureDir(PARSED_DIR);
  await fs.writeFile(OUTPUT_PATH, '', 'utf8');

  const targetFile = await resolveTargetTextDump(TEXT_DIR, argv['title-fragment']);
  const text = await fs.readFile(targetFile, 'utf8');
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);

  const summary = {
    target_text_dump: targetFile,
    generated_at: new Date().toISOString(),
    total_lines: lines.length,
    seat_rows_emitted: 0,
    state_lines_seen: 0,
    header_lines_seen: 0,
    header_buffer_merges: 0,
    skipped_header_noise_lines: 0,
    parse_confidence_counts: {},
    first_emitted_rows: [],
  };

  let currentState = null;
  let currentInstitutionCodeRaw = null;
  let headerBuffer = [];
  let currentInstitutionHeaderRaw = null;
  let currentInstitutionNameGuess = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isNoiseLine(line)) continue;

    const stateOnly = detectStateOnlyLine(line);
    if (stateOnly) {
      currentState = stateOnly;
      summary.state_lines_seen += 1;
      continue;
    }

    const seatRow = parseSeatRowLine(line, currentInstitutionCodeRaw);
    if (seatRow) {
      const mergedHeader = mergeHeaderContext(headerBuffer, seatRow.leading_context_raw);
      if (mergedHeader.state_raw) currentState = mergedHeader.state_raw;
      if (mergedHeader.institution_code_raw) currentInstitutionCodeRaw = mergedHeader.institution_code_raw;
      if (mergedHeader.header_raw) currentInstitutionHeaderRaw = mergedHeader.header_raw;
      if (mergedHeader.institution_name_guess) currentInstitutionNameGuess = mergedHeader.institution_name_guess;
      if (seatRow.institute_code_raw) currentInstitutionCodeRaw = seatRow.institute_code_raw;
      if (headerBuffer.length && seatRow.leading_context_raw) summary.header_buffer_merges += 1;

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
        address_fragment_raw: seatRow.address_fragment_raw,
        quota_raw: seatRow.quota_raw,
        course_name_raw: seatRow.course_name_raw,
        category_code_raw: seatRow.category_code_raw,
        seat_suffix_raw: seatRow.seat_suffix_raw,
        seat_count: seatRow.seat_count,
        raw_line: line,
        line_index: i,
      };

      emitted.parse_confidence = scoreConfidence(emitted);
      emitted.entity_key = [
        'MCC', 'MCC_UG', normalizeKey(emitted.round_inferred), normalizeKey(emitted.institution_code_raw),
        normalizeKey(emitted.institution_name_guess), normalizeKey(emitted.quota_raw), normalizeKey(emitted.course_name_raw),
        normalizeKey(emitted.category_code_raw), emitted.seat_count ?? ''
      ].join('||');
      emitted.source_row_fingerprint = [emitted.entity_key, normalizeKey(emitted.raw_line)].join('||');

      await fs.appendFile(OUTPUT_PATH, JSON.stringify(emitted) + '\n', 'utf8');
      summary.seat_rows_emitted += 1;
      inc(summary.parse_confidence_counts, emitted.parse_confidence);
      if (summary.first_emitted_rows.length < 12) summary.first_emitted_rows.push(emitted);

      headerBuffer = [];
      continue;
    }

    const header = parseInstitutionHeaderLikeLine(line, currentState);
    if (header) {
      if (isHeaderNoise(header.header_raw)) {
        summary.skipped_header_noise_lines += 1;
        continue;
      }
      if (header.state_raw) currentState = header.state_raw;
      if (header.institution_code_raw) currentInstitutionCodeRaw = header.institution_code_raw;
      headerBuffer.push(header.header_raw);
      currentInstitutionHeaderRaw = mergeHeaderParts(headerBuffer);
      currentInstitutionNameGuess = guessInstitutionName(currentInstitutionHeaderRaw);
      summary.header_lines_seen += 1;
      continue;
    }
  }

  await fs.writeJson(META_PATH, summary, { spaces: 2 });
  console.log('MCC UG block parse complete');
  console.log(JSON.stringify({
    target_text_dump: targetFile,
    total_lines: summary.total_lines,
    seat_rows_emitted: summary.seat_rows_emitted,
    state_lines_seen: summary.state_lines_seen,
    header_lines_seen: summary.header_lines_seen,
    header_buffer_merges: summary.header_buffer_merges,
    skipped_header_noise_lines: summary.skipped_header_noise_lines,
    parse_confidence_counts: summary.parse_confidence_counts,
    output_path: OUTPUT_PATH,
  }, null, 2));
}

async function resolveTargetTextDump(textDir, fragment) {
  const files = (await fs.readdir(textDir)).filter((x) => x.toLowerCase().endsWith('.txt'));
  const hit = files.find((x) => x.toUpperCase().includes(String(fragment || '').toUpperCase()));
  if (!hit) throw new Error(`Could not find text dump containing fragment: ${fragment}`);
  return path.join(textDir, hit);
}

function parseSeatRowLine(line, fallbackInstituteCode) {
  const cleaned = clean(line);
  const seatMatch = cleaned.match(/\s(\d+)$/);
  if (!seatMatch) return null;
  const seatCount = Number(seatMatch[1]);
  const core = clean(cleaned.slice(0, seatMatch.index));

  const courseMatch = core.match(/(MBBS\s*\(MBBS\)|BDS\s*\(BDS\)|B\.?\s*SC\s*\(?NURSING\)?(?:\s*\([^)]*\))?)/i);
  if (!courseMatch) return null;

  const beforeCourse = clean(core.slice(0, courseMatch.index));
  const afterCourse = clean(core.slice(courseMatch.index + courseMatch[0].length));
  if (!afterCourse) return null;

  const tail = afterCourse.match(/^([A-Z]{2,4})\s+([A-Z]{2,4})$/i);
  if (!tail) return null;

  let instituteCodeRaw = fallbackInstituteCode || null;
  const codeMatch = beforeCourse.match(/\((\d{6})\)/);
  if (codeMatch) instituteCodeRaw = codeMatch[1];

  const quotaHit = findQuota(beforeCourse);
  let leadingContextRaw = null;
  let addressFragmentRaw = null;
  let quotaRaw = null;

  if (quotaHit) {
    leadingContextRaw = clean(beforeCourse.slice(0, quotaHit.index)) || null;
    quotaRaw = quotaHit.value;
    addressFragmentRaw = clean(beforeCourse.slice(quotaHit.index + quotaHit.value.length)) || null;
  } else {
    quotaRaw = clean(beforeCourse) || null;
  }

  return {
    institute_code_raw: instituteCodeRaw,
    leading_context_raw: leadingContextRaw,
    address_fragment_raw: addressFragmentRaw,
    quota_raw: quotaRaw,
    course_name_raw: normalizeCourseName(courseMatch[0]),
    category_code_raw: tail[1].toUpperCase(),
    seat_suffix_raw: tail[2].toUpperCase(),
    seat_count: seatCount,
  };
}

function findQuota(text) {
  const cleaned = clean(text);
  const hits = [];
  for (const quota of QUOTA_PATTERNS) {
    const idx = cleaned.toLowerCase().indexOf(quota.toLowerCase());
    if (idx !== -1) hits.push({ index: idx, value: quota });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => a.index - b.index);
  return hits[0];
}

function parseInstitutionHeaderLikeLine(line, currentState) {
  const cleaned = clean(line);
  if (!cleaned) return null;
  if (/(MBBS\s*\(MBBS\)|BDS\s*\(BDS\)|NURSING)/i.test(cleaned)) return null;
  if (/\b(OP|SC|ST|EW|BC|NO|PH)\b\s+\d+$/i.test(cleaned)) return null;

  let stateRaw = currentState;
  let headerBody = cleaned;
  const prefixedState = detectLeadingState(cleaned);
  if (prefixedState) {
    stateRaw = prefixedState.state_raw;
    headerBody = prefixedState.rest;
  }

  const hasMedicalWord = /medical college|aiims|institute|hospital|university|college/i.test(headerBody);
  const hasPinOrCode = /\b\d{6}\b|\(\d{6}\)/.test(headerBody);
  if (!hasMedicalWord && !hasPinOrCode) return null;

  return {
    state_raw: stateRaw,
    institution_code_raw: extractInstitutionCode(cleaned),
    header_raw: cleaned,
  };
}

function mergeHeaderContext(headerBuffer, leadingContextRaw) {
  const parts = [...headerBuffer];
  if (leadingContextRaw && !isHeaderNoise(leadingContextRaw)) parts.push(leadingContextRaw);
  const mergedHeader = mergeHeaderParts(parts);
  const prefixedState = detectLeadingState(mergedHeader || '');
  const stateRaw = prefixedState ? prefixedState.state_raw : null;
  return {
    state_raw: stateRaw,
    institution_code_raw: extractInstitutionCode(mergedHeader || ''),
    header_raw: mergedHeader || null,
    institution_name_guess: guessInstitutionName(prefixedState ? prefixedState.rest : mergedHeader),
  };
}

function mergeHeaderParts(parts) {
  const filtered = parts
    .filter(Boolean)
    .map(clean)
    .filter((p) => !isHeaderNoise(p));
  return clean(filtered.join(', ')) || null;
}

function detectLeadingState(line) {
  const upper = clean(line).toUpperCase();
  for (const state of STATES) {
    if (upper.startsWith(state + ' ')) {
      return { state_raw: toTitleCase(state), rest: clean(line.slice(state.length)) };
    }
  }
  return null;
}

function detectStateOnlyLine(line) {
  const normalized = clean(line).toUpperCase().replace(/&/g, 'AND').replace(/\s+/g, ' ').trim();
  for (const state of STATES) {
    if (normalized === state) return toTitleCase(state);
  }
  return null;
}

function guessInstitutionName(headerRaw) {
  const cleaned = clean(headerRaw).replace(/\(\d{6}\)/g, '').trim();
  if (!cleaned) return null;

  const parts = cleaned
    .split(',')
    .map(clean)
    .filter(Boolean)
    .filter((p) => !isHeaderNoise(p));

  const meaningful = parts.filter((p) => /medical college|aiims|institute|hospital|university|college/i.test(p));
  if (meaningful.length) {
    const sorted = meaningful.sort((a, b) => scoreInstitutionPhrase(b, parts) - scoreInstitutionPhrase(a, parts));
    const best = sorted[0];

    if (isGenericInstitutionPhrase(best)) {
      const idx = parts.findIndex((p) => p === best);
      if (idx !== -1) {
        const prev = idx > 0 ? parts[idx - 1] : null;
        const next = idx + 1 < parts.length ? parts[idx + 1] : null;
        if (prev && !looksLikeAddress(prev) && !isHeaderNoise(prev)) return `${prev}, ${best}`;
        if (next && !looksLikeAddress(next) && !isHeaderNoise(next)) return `${best}, ${next}`;
      }
    }

    return best;
  }

  for (const part of parts) {
    if (/^\d{6}$/.test(part) || /^\(?\d{6}\)?$/.test(part)) continue;
    if (STATES.includes(part.toUpperCase())) continue;
    if (looksLikeAddress(part)) continue;
    return part;
  }
  return null;
}

function scoreInstitutionPhrase(text, allParts) {
  const t = clean(text);
  let score = 0;
  if (/medical college/i.test(t)) score += 50;
  if (/aiims/i.test(t)) score += 45;
  if (/institute/i.test(t)) score += 30;
  if (/hospital/i.test(t)) score += 20;
  if (/university/i.test(t)) score += 20;
  if (/college/i.test(t)) score += 15;

  if (/^medical college$/i.test(t)) score -= 120;
  if (/^government medical college$/i.test(t)) score -= 80;
  if (/^college$/i.test(t)) score -= 120;
  if (/^hospital$/i.test(t)) score -= 120;
  if (/^pradesh$/i.test(t)) score -= 150;
  if (/^faridabad$/i.test(t)) score -= 60;
  if (/^\d+$/.test(t)) score -= 150;
  if (isHeaderNoise(t)) score -= 200;

  const idx = allParts.findIndex((p) => p === t);
  if (idx !== -1) {
    const prev = idx > 0 ? allParts[idx - 1] : null;
    const next = idx + 1 < allParts.length ? allParts[idx + 1] : null;
    if (prev && !looksLikeAddress(prev) && !STATES.includes(prev.toUpperCase())) score += 10;
    if (next && !looksLikeAddress(next) && !STATES.includes(next.toUpperCase())) score += 10;
  }

  score += Math.min(t.length, 40);
  return score;
}

function isGenericInstitutionPhrase(text) {
  const t = clean(text);
  return [
    /^medical college$/i,
    /^government medical college$/i,
    /^college$/i,
    /^hospital$/i,
    /^institute$/i,
  ].some((rx) => rx.test(t));
}

function looksLikeAddress(text) {
  const t = clean(text);
  return /road|nagar|district|dist\.|pin|pincode|near|post|po\b|campus|village|taluka|tehsil|state|city|bus stand|main road|jail road|circle|building/i.test(t);
}

function isHeaderNoise(text) {
  const t = clean(text);
  return HEADER_NOISE_PATTERNS.some((rx) => rx.test(t));
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

function scoreConfidence(row) {
  let score = 0;
  if (row.seat_count != null) score += 25;
  if (row.course_name_raw) score += 20;
  if (row.quota_raw) score += 15;
  if (row.institution_name_guess) score += 25;
  if (row.institution_code_raw) score += 10;
  if (row.institution_state_raw) score += 5;
  if (row.address_fragment_raw) score += 2;
  if (score >= 85) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function isNoiseLine(line) {
  const t = clean(line).toLowerCase();
  if (!t) return true;
  return [
    /^page \d+/,
    /^medical counselling committee/,
    /^directorate general of health services/,
    /^ministry of health/,
    /^government of india/,
    /^seat matrix$/,
    /^ug counselling$/,
    /^neet ug counselling$/,
    /^institute$/,
    /^quota$/,
    /^course$/,
    /^seat$/,
    /^statename institute quota branch category totalseats$/,
  ].some((rx) => rx.test(t));
}

function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function normalizeKey(value) { return clean(value).toLowerCase(); }
function toTitleCase(value) { return String(value || '').toLowerCase().split(' ').map((w)=>w ? w[0].toUpperCase()+w.slice(1):w).join(' ').replace(/And/g,'and'); }
function inc(obj, key) { obj[key] = (obj[key] || 0) + 1; }

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
