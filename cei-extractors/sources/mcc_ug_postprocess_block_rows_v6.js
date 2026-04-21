#!/usr/bin/env node

/**
 * MCC UG block-row postprocessor for V6 output
 *
 * Goal:
 * - Clean the last weak institution-name cases without changing parser architecture
 * - Normalize state casing
 * - Repair generic institution names using institution_header_raw context
 * - Collapse duplicate institution patterns like "AIIMS Jammu, AIIMS"
 * - Preserve original values before cleanup
 *
 * Usage:
 *   node mcc_ug_postprocess_block_rows_v6.js --dir=./output/mcc_ug_selected_docs
 *
 * Output:
 *   ./output/mcc_ug_selected_docs/parsed_seat_matrix/mcc_ug_special_stray_block_rows_v6_cleaned.ndjson
 */

const fs = require('fs-extra');
const path = require('path');
const minimist = require('minimist');
const split2 = require('split2');

const argv = minimist(process.argv.slice(2), {
  string: ['dir'],
  default: {
    dir: path.resolve(process.cwd(), 'output', 'mcc_ug_selected_docs'),
  },
});

const TARGET_DIR = path.resolve(argv.dir);
const PARSED_DIR = path.join(TARGET_DIR, 'parsed_seat_matrix');
const INPUT_PATH = path.join(PARSED_DIR, 'mcc_ug_special_stray_block_rows_v6.ndjson');
const OUTPUT_PATH = path.join(PARSED_DIR, 'mcc_ug_special_stray_block_rows_v6_cleaned.ndjson');
const META_PATH = path.join(PARSED_DIR, 'mcc_ug_special_stray_block_rows_v6_cleaned.meta.json');

const STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli',
  'Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

const HEADER_NOISE_PATTERNS = [
  /^StateName\s+Institute\s+Quota\s+Branch\s+Category\s+TotalSeats$/i,
  /StateName/i,
  /Institute\s+Quota/i,
  /Branch\s+Category/i,
  /TotalSeats/i,
];

async function main() {
  if (!(await fs.pathExists(INPUT_PATH))) {
    throw new Error(`Missing ${INPUT_PATH}`);
  }

  await fs.ensureDir(PARSED_DIR);
  await fs.writeFile(OUTPUT_PATH, '', 'utf8');

  const summary = {
    input_path: INPUT_PATH,
    output_path: OUTPUT_PATH,
    generated_at: new Date().toISOString(),
    rows_read: 0,
    rows_written: 0,
    rows_skipped_empty: 0,
    rows_skipped_invalid_json: 0,
    changed_state_count: 0,
    changed_institution_name_count: 0,
    generic_before: 0,
    generic_after: 0,
    missing_before: 0,
    missing_after: 0,
    bad_header_noise_after: 0,
    sample_changes: [],
  };

  const out = fs.createWriteStream(OUTPUT_PATH, { encoding: 'utf8' });

  await new Promise((resolve, reject) => {
    fs.createReadStream(INPUT_PATH, 'utf8')
      .pipe(split2())
      .on('data', (line) => {
        try {
          const text = String(line || '').trim();
          if (!text) {
            summary.rows_skipped_empty += 1;
            return;
          }

          let row;
          try {
            row = JSON.parse(text);
          } catch {
            summary.rows_skipped_invalid_json += 1;
            return;
          }

          summary.rows_read += 1;

          const originalState = row.institution_state_raw ?? null;
          const originalName = row.institution_name_guess ?? null;

          if (!originalName) summary.missing_before += 1;
          if (isGenericInstitutionName(originalName)) summary.generic_before += 1;

          row.institution_state_raw_before_cleanup = originalState;
          row.institution_name_guess_before_cleanup = originalName;

          row.institution_state_raw = normalizeStateCase(originalState);
          row.institution_name_guess = cleanupInstitutionName(
            row.institution_name_guess,
            row.institution_header_raw
          );

          if (!row.institution_name_guess) summary.missing_after += 1;
          if (isGenericInstitutionName(row.institution_name_guess)) summary.generic_after += 1;
          if (hasHeaderNoise(row.institution_header_raw)) summary.bad_header_noise_after += 1;

          if (originalState !== row.institution_state_raw) {
            summary.changed_state_count += 1;
          }

          if (originalName !== row.institution_name_guess) {
            summary.changed_institution_name_count += 1;
            if (summary.sample_changes.length < 12) {
              summary.sample_changes.push({
                institution_code_raw: row.institution_code_raw || null,
                before: originalName,
                after: row.institution_name_guess,
                header: row.institution_header_raw || null,
              });
            }
          }

          row.entity_key = [
            'MCC',
            'MCC_UG',
            normalizeKey(row.round_inferred),
            normalizeKey(row.institution_code_raw),
            normalizeKey(row.institution_name_guess),
            normalizeKey(row.quota_raw),
            normalizeKey(row.course_name_raw),
            normalizeKey(row.category_code_raw),
            row.seat_count ?? '',
          ].join('||');

          row.source_row_fingerprint = [
            row.entity_key,
            normalizeKey(row.raw_line),
          ].join('||');

          out.write(JSON.stringify(row) + '\n');
          summary.rows_written += 1;
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject)
      .on('end', resolve);
  });

  await new Promise((resolve, reject) =>
    out.end((err) => (err ? reject(err) : resolve()))
  );

  await fs.writeJson(META_PATH, summary, { spaces: 2 });

  console.log('MCC UG block postprocess complete');
  console.log(JSON.stringify(summary, null, 2));
}

function cleanupInstitutionName(name, header) {
  const original = clean(name);
  const headerClean = cleanHeader(header);
  const parts = splitHeaderParts(headerClean);

  let candidate = collapseDuplicateName(original);

  if (!candidate || isGenericInstitutionName(candidate) || endsWithWeakTail(candidate)) {
    const inferred = inferInstitutionNameFromHeader(parts);
    if (inferred) candidate = inferred;
  }

  candidate = collapseDuplicateName(candidate);
  candidate = normalizeInstitutionNameCasing(candidate);

  if (isGenericInstitutionName(candidate)) {
    const recovered = recoverFromGenericWithNeighbor(parts, candidate);
    if (recovered) candidate = normalizeInstitutionNameCasing(recovered);
  }

  return candidate || original || null;
}

function inferInstitutionNameFromHeader(parts) {
  const candidates = [];

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (!part || isNoisePart(part) || looksLikeAddress(part) || isState(part)) continue;

    const prev = i > 0 ? parts[i - 1] : null;
    const next = i + 1 < parts.length ? parts[i + 1] : null;

    if (isInstitutionLike(part)) {
      candidates.push(part);

      if (next && shouldExtendRight(part, next)) {
        candidates.push(`${part}, ${next}`);
      }

      if (prev && shouldExtendLeft(prev, part)) {
        candidates.push(`${prev}, ${part}`);
      }
    }

    if (isGenericInstitutionName(part)) {
      const recovered = recoverFromGenericWithNeighbor(parts, part);
      if (recovered) candidates.push(recovered);
    }
  }

  if (!candidates.length) return null;

  const unique = Array.from(new Set(candidates.map(clean).filter(Boolean)));
  unique.sort((a, b) => scoreInstitutionCandidate(b, parts) - scoreInstitutionCandidate(a, parts));
  return unique[0] || null;
}

function recoverFromGenericWithNeighbor(parts, generic) {
  const genericClean = clean(generic);
  const idx = parts.findIndex((p) => clean(p).toLowerCase() === genericClean.toLowerCase());
  if (idx === -1) return null;

  const prev = idx > 0 ? parts[idx - 1] : null;
  const next = idx + 1 < parts.length ? parts[idx + 1] : null;

  if (genericClean.toLowerCase() === 'aiims') {
    if (prev && /^aiims\s+/i.test(prev)) return prev;
    if (next && !looksLikeAddress(next) && !isState(next)) return `AIIMS ${next}`;
  }

  if (genericClean.toLowerCase() === 'medical college') {
    if (prev && !looksLikeAddress(prev) && !isState(prev)) return `${genericClean}, ${prev}`;
    if (next && !looksLikeAddress(next) && !isState(next)) return `${genericClean}, ${next}`;
  }

  if (prev && !looksLikeAddress(prev) && !isState(prev)) return `${prev}, ${genericClean}`;
  if (next && !looksLikeAddress(next) && !isState(next)) return `${genericClean}, ${next}`;
  return null;
}

function collapseDuplicateName(name) {
  const text = clean(name);
  if (!text) return null;

  const aiimsDup = text.match(/^(AIIMS\s+[^,]+),\s*AIIMS$/i);
  if (aiimsDup) return aiimsDup[1];

  const dup = text.match(/^(.*?),\s*\1$/i);
  if (dup) return dup[1];

  return text;
}

function scoreInstitutionCandidate(text, parts) {
  const t = clean(text);
  let score = 0;

  if (/medical/i.test(t)) score += 50;
  if (/med\./i.test(t)) score += 35;
  if (/college/i.test(t)) score += 20;
  if (/hospital/i.test(t)) score += 20;
  if (/institute/i.test(t)) score += 30;
  if (/university/i.test(t)) score += 20;
  if (/aiims\s+/i.test(t)) score += 60;
  if (/aiims/i.test(t) && !/aiims\s+/i.test(t)) score += 10;
  if (/research|res\./i.test(t)) score += 20;
  if (/gitam/i.test(t)) score += 40;

  if (isGenericInstitutionName(t)) score -= 130;
  if (endsWithWeakTail(t)) score -= 90;
  if (looksLikeAddress(t)) score -= 120;
  if (isNoisePart(t)) score -= 250;
  if (/^\d+$/.test(t)) score -= 200;

  const words = t.split(/\s+/).length;
  score += Math.min(words * 6, 36);
  score += Math.min(t.length, 50);

  const idx = parts.findIndex((p) => clean(p).toLowerCase() === t.toLowerCase());
  if (idx !== -1) {
    const prev = idx > 0 ? parts[idx - 1] : null;
    const next = idx + 1 < parts.length ? parts[idx + 1] : null;
    if (prev && !looksLikeAddress(prev) && !isState(prev) && !isNoisePart(prev)) score += 8;
    if (next && !looksLikeAddress(next) && !isState(next) && !isNoisePart(next)) score += 8;
  }

  return score;
}

function splitHeaderParts(header) {
  return clean(header)
    .split(',')
    .map(clean)
    .filter(Boolean)
    .filter((p) => !isNoisePart(p));
}

function cleanHeader(header) {
  return clean(header)
    .replace(/\(\d{6}\)/g, '')
    .replace(/\s+,/g, ',')
    .replace(/,+/g, ',')
    .trim();
}

function normalizeInstitutionNameCasing(name) {
  const text = clean(name);
  if (!text) return null;

  return text
    .split(',')
    .map((segment) => {
      const s = clean(segment);
      if (!s) return s;

      if (/^[A-Z0-9 .&()'/-]+$/.test(s)) {
        return s
          .toLowerCase()
          .split(' ')
          .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
          .join(' ')
          .replace(/Aiims/g, 'AIIMS')
          .replace(/Esic/g, 'ESIC')
          .replace(/Gitam/g, 'GITAM')
          .replace(/Med\./g, 'Med.')
          .replace(/Res\./g, 'Res.');
      }

      return s;
    })
    .join(', ')
    .replace(/\bOf\b/g, 'of')
    .replace(/\bAnd\b/g, 'and');
}

function normalizeStateCase(value) {
  const text = clean(value);
  if (!text) return null;
  const hit = STATES.find((s) => s.toLowerCase() === text.toLowerCase());
  return hit || titleCaseLoose(text);
}

function titleCaseLoose(value) {
  return clean(value)
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/\bAnd\b/g, 'and');
}

function isInstitutionLike(text) {
  const t = clean(text);
  return /medical|med\.|aiims|institute|hospital|university|college|res\./i.test(t);
}

function shouldExtendRight(base, next) {
  const b = clean(base);
  const n = clean(next);
  if (!n || looksLikeAddress(n) || isState(n) || isNoisePart(n)) return false;
  if (/\bof$/i.test(b)) return true;
  if (isGenericInstitutionName(b)) return true;
  if (/^aiims$/i.test(b)) return true;
  return false;
}

function shouldExtendLeft(prev, base) {
  const p = clean(prev);
  const b = clean(base);
  if (!p || looksLikeAddress(p) || isState(p) || isNoisePart(p)) return false;
  if (isGenericInstitutionName(b)) return true;
  if (/^aiims$/i.test(b)) return true;
  return false;
}

function isGenericInstitutionName(text) {
  const t = clean(text);
  return [
    /^medical college$/i,
    /^government medical college$/i,
    /^college$/i,
    /^hospital$/i,
    /^institute$/i,
    /^aiims$/i,
    /^pradesh$/i,
  ].some((rx) => rx.test(t));
}

function endsWithWeakTail(text) {
  const t = clean(text);
  return /(\bof|\band|medical college|college|hospital)$/i.test(t);
}

function looksLikeAddress(text) {
  const t = clean(text);
  return /road|nagar|district|dist\.|pin|pincode|near|post|po\b|campus|village|taluka|tehsil|state|city|bus stand|main road|jail road|circle|building|anandpura|borbari|dibrugarh|visakhapatnam|faridabad|bhavnagar|vadodara/i.test(t) &&
    !/medical|med\.|aiims|institute|hospital|university|college|res\./i.test(t);
}

function isState(text) {
  const t = clean(text);
  return STATES.some((s) => s.toLowerCase() === t.toLowerCase());
}

function isNoisePart(text) {
  const t = clean(text);
  return HEADER_NOISE_PATTERNS.some((rx) => rx.test(t));
}

function hasHeaderNoise(text) {
  return isNoisePart(text);
}

function normalizeKey(value) {
  return clean(value).toLowerCase();
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});