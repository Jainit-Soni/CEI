#!/usr/bin/env node

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
const OUTPUT_PATH = path.join(PARSED_DIR, 'mcc_ug_special_stray_block_rows_v6b_cleaned.ndjson');
const META_PATH = path.join(PARSED_DIR, 'mcc_ug_special_stray_block_rows_v6b_cleaned.meta.json');

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

          const normalizedState = normalizeStateCase(originalState);
          if (normalizedState !== originalState) {
            summary.changed_state_count += 1;
          }
          row.institution_state_raw = normalizedState;

          const cleanedName = cleanupInstitutionNameConservative(
            originalName,
            row.institution_header_raw
          );

          if (cleanedName !== originalName) {
            summary.changed_institution_name_count += 1;
            if (summary.sample_changes.length < 12) {
              summary.sample_changes.push({
                institution_code_raw: row.institution_code_raw || null,
                before: originalName,
                after: cleanedName,
                header: row.institution_header_raw || null,
              });
            }
          }

          row.institution_name_guess = cleanedName;

          if (!row.institution_name_guess) summary.missing_after += 1;
          if (isGenericInstitutionName(row.institution_name_guess)) summary.generic_after += 1;
          if (hasHeaderNoise(row.institution_header_raw)) summary.bad_header_noise_after += 1;

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

  await new Promise((resolve, reject) => {
    out.end((err) => (err ? reject(err) : resolve()));
  });

  await fs.writeJson(META_PATH, summary, { spaces: 2 });

  console.log('MCC UG conservative postprocess complete');
  console.log(JSON.stringify(summary, null, 2));
}

function cleanupInstitutionNameConservative(name, header) {
  const original = clean(name);
  const headerParts = splitHeaderParts(cleanHeader(header));

  if (!original) {
    const inferred = inferBestInstitutionName(headerParts);
    return inferred || null;
  }

  const collapsed = collapseDuplicateName(original);
  if (collapsed !== original) {
    return normalizeInstitutionNameCasing(collapsed);
  }

  const shouldRepair =
    isGenericInstitutionName(original) ||
    endsWithWeakTail(original);

  if (!shouldRepair) {
    return normalizeInstitutionNameCasing(original);
  }

  const repaired = repairWeakInstitutionName(original, headerParts);
  return normalizeInstitutionNameCasing(repaired || original);
}

function repairWeakInstitutionName(original, parts) {
  const cleanedOriginal = clean(original);

  if (/^aiims$/i.test(cleanedOriginal)) {
    const aiimsSpecific = parts.find((p) => /^aiims\s+/i.test(clean(p)));
    if (aiimsSpecific) return aiimsSpecific;
  }

  if (/^medical college$/i.test(cleanedOriginal)) {
    const withLocation = parts.find((p) => /^medical college,\s*[^,]+$/i.test(clean(p)));
    if (withLocation) return withLocation;

    const idx = parts.findIndex((p) => /^medical college$/i.test(clean(p)));
    if (idx !== -1) {
      const next = idx + 1 < parts.length ? parts[idx + 1] : null;
      if (next && !looksLikeAddress(next) && !isState(next) && !isNoisePart(next)) {
        return `Medical College, ${next}`;
      }
    }
  }

  if (endsWithWeakTail(cleanedOriginal)) {
    const fuller = parts.find((p) => {
      const cp = clean(p);
      return (
        cp.length > cleanedOriginal.length &&
        normalizeLoose(cp).includes(normalizeLoose(cleanedOriginal)) &&
        isInstitutionLike(cp) &&
        !looksLikeAddress(cp)
      );
    });
    if (fuller) return fuller;
  }

  const inferred = inferBestInstitutionName(parts);
  return inferred || cleanedOriginal;
}

function inferBestInstitutionName(parts) {
  const candidates = [];

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (!part || isNoisePart(part) || looksLikeAddress(part) || isState(part)) continue;

    if (isInstitutionLike(part)) {
      candidates.push(part);
    }

    const prev = i > 0 ? parts[i - 1] : null;
    const next = i + 1 < parts.length ? parts[i + 1] : null;

    if (/^aiims$/i.test(clean(part)) && next && !looksLikeAddress(next) && !isState(next)) {
      candidates.push(`AIIMS ${next}`);
    }

    if (/^medical college$/i.test(clean(part))) {
      if (next && !looksLikeAddress(next) && !isState(next)) {
        candidates.push(`Medical College, ${next}`);
      }
      if (prev && !looksLikeAddress(prev) && !isState(prev)) {
        candidates.push(`${prev}, Medical College`);
      }
    }
  }

  if (!candidates.length) return null;

  const unique = Array.from(new Set(candidates.map(clean).filter(Boolean)));
  unique.sort((a, b) => scoreInstitutionCandidate(b) - scoreInstitutionCandidate(a));
  return unique[0] || null;
}

function scoreInstitutionCandidate(text) {
  const t = clean(text);
  let score = 0;

  if (/medical/i.test(t)) score += 50;
  if (/med\./i.test(t)) score += 35;
  if (/college/i.test(t)) score += 20;
  if (/hospital/i.test(t)) score += 20;
  if (/institute/i.test(t)) score += 30;
  if (/university/i.test(t)) score += 20;
  if (/aiims\s+/i.test(t)) score += 60;
  if (/research|res\./i.test(t)) score += 20;
  if (/gitam/i.test(t)) score += 40;

  if (isGenericInstitutionName(t)) score -= 140;
  if (endsWithWeakTail(t)) score -= 70;
  if (looksLikeAddress(t)) score -= 120;
  if (isNoisePart(t)) score -= 250;
  if (/^\d+$/.test(t)) score -= 200;

  const words = t.split(/\s+/).length;
  score += Math.min(words * 6, 36);
  score += Math.min(t.length, 50);

  return score;
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

function splitHeaderParts(header) {
  return clean(header)
    .split(',')
    .map(clean)
    .filter(Boolean)
    .filter((p) => !isNoisePart(p))
    .map(stripLeadingStateWord);
}

function cleanHeader(header) {
  return clean(header)
    .replace(/\(\d{6}\)/g, '')
    .replace(/\s+,/g, ',')
    .replace(/,+/g, ',')
    .trim();
}

function stripLeadingStateWord(text) {
  const cleaned = clean(text);
  if (!cleaned) return cleaned;

  for (const state of STATES) {
    if (cleaned.toLowerCase().startsWith(state.toLowerCase() + ' ')) {
      return clean(cleaned.slice(state.length));
    }
  }

  return cleaned;
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
  return /(\bof|\band)$/i.test(t);
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

function normalizeLoose(text) {
  return clean(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
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