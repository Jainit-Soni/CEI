#!/usr/bin/env node

/**
 * MCC UG manifest -> high-value doc selector
 *
 * Goal:
 * - Avoid downloading tons of PDFs
 * - Read the UG manifest and select only the few docs most useful for CEI
 * - Prefer 2025 docs and core fact types only
 *
 * Core kept families:
 * - seat_matrix
 * - result
 * - vacancy
 * - schedule
 *
 * Notes:
 * - Keeps one or a few best docs per family/round/course bucket
 * - Drops generic notices unless they look operationally important
 * - Writes a compact NDJSON selection manifest for targeted download
 *
 * Install:
 *   npm i fs-extra minimist split2
 *
 * Usage:
 *   node mcc_ug_select_high_value_docs.js \
 *     --in=./output/mcc_ug_documents_manifest.ndjson \
 *     --out=./output/mcc_ug_documents_selected.ndjson
 */

const fs = require('fs-extra');
const path = require('path');
const split2 = require('split2');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  string: ['in', 'out', 'year'],
  default: {
    year: '2025',
  },
});

const INPUT_PATH = argv.in ? path.resolve(argv.in) : null;
const OUTPUT_PATH = argv.out ? path.resolve(argv.out) : null;
const META_PATH = OUTPUT_PATH
  ? path.join(path.dirname(OUTPUT_PATH), path.basename(OUTPUT_PATH, path.extname(OUTPUT_PATH)) + '.meta.json')
  : null;
const TARGET_YEAR = Number(argv.year || 2025);

if (!INPUT_PATH || !OUTPUT_PATH) {
  console.error('Missing required args. Use --in=... --out=...');
  process.exit(1);
}

async function main() {
  await fs.ensureDir(path.dirname(OUTPUT_PATH));
  await fs.writeFile(OUTPUT_PATH, '', 'utf8');

  const rows = await readNdjson(INPUT_PATH);
  const scored = rows
    .map((row) => ({ row, score: scoreRow(row) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const selected = selectRows(scored.map((x) => x.row));
  await fs.writeFile(OUTPUT_PATH, selected.map((r) => JSON.stringify(r)).join('\n') + (selected.length ? '\n' : ''), 'utf8');

  const meta = {
    input_path: INPUT_PATH,
    output_path: OUTPUT_PATH,
    target_year: TARGET_YEAR,
    rows_read: rows.length,
    rows_selected: selected.length,
    by_doc_family: countBy(selected, 'doc_family'),
    by_round: countBy(selected, 'round_inferred'),
    by_course_bucket: countBy(selected, 'course_bucket_inferred'),
    finished_at: new Date().toISOString(),
  };

  await fs.writeJson(META_PATH, meta, { spaces: 2 });
  console.log('Selection complete');
  console.log(JSON.stringify(meta, null, 2));
}

function scoreRow(row) {
  const title = norm(row.document_title);
  let score = 0;

  if ((row.inferred_year || null) === TARGET_YEAR) score += 50;
  else if ((row.inferred_year || 0) >= TARGET_YEAR - 1) score += 15;

  if (row.doc_family === 'seat_matrix') score += 40;
  if (row.doc_family === 'result') score += 35;
  if (row.doc_family === 'vacancy') score += 30;
  if (row.doc_family === 'schedule') score += 20;
  if (row.doc_family === 'notice') score -= 20;
  if (row.doc_family === 'admitted_candidates') score -= 10;

  if (/final result/i.test(title)) score += 15;
  if (/provisional result/i.test(title)) score += 8;
  if (/clear vacancy/i.test(title)) score += 12;
  if (/seat matrix/i.test(title)) score += 12;
  if (/schedule/i.test(title)) score += 8;

  if (/special stray/i.test(title)) score += 6;
  if (/stray/i.test(title)) score += 4;
  if (/round\s*[1i]\b/i.test(title)) score += 2;
  if (/round\s*[2i]{1,2}\b/i.test(title)) score += 2;
  if (/round\s*3\b/i.test(title)) score += 2;
  if (/round\s*5\b/i.test(title)) score -= 6;

  if (/mbbs|bds|b\.?\s*sc\s*nursing/i.test(title)) score += 5;
  if (/corrigendum|revised schedule|notice|important notice|joining extension|extension/i.test(title)) score -= 8;

  if (!row.view_url) score -= 100;

  return score;
}

function selectRows(rows) {
  const out = [];
  const seenUrl = new Set();

  const requiredFamilies = ['seat_matrix', 'result', 'vacancy', 'schedule'];

  for (const family of requiredFamilies) {
    const familyRows = rows.filter((r) => r.doc_family === family).sort((a, b) => scoreRow(b) - scoreRow(a));

    const byRound = new Map();
    for (const row of familyRows) {
      const round = row.round_inferred || 'UNSPECIFIED';
      if (!byRound.has(round)) byRound.set(round, []);
      byRound.get(round).push(row);
    }

    for (const [round, group] of byRound.entries()) {
      const limit = family === 'schedule' ? 1 : 2;
      let kept = 0;
      for (const row of group) {
        if (seenUrl.has(row.view_url)) continue;
        out.push(withSelectionReason(row));
        seenUrl.add(row.view_url);
        kept += 1;
        if (kept >= limit) break;
      }
    }
  }

  const fallbackNotices = rows
    .filter((r) => r.doc_family === 'notice')
    .filter((r) => /added seats|withdrawn|withdrawal|reduction|increase|conversion|eligibility/i.test(norm(r.document_title)))
    .sort((a, b) => scoreRow(b) - scoreRow(a));

  for (const row of fallbackNotices.slice(0, 6)) {
    if (seenUrl.has(row.view_url)) continue;
    out.push(withSelectionReason(row));
    seenUrl.add(row.view_url);
  }

  return out.sort((a, b) => {
    const sa = scoreRow(a);
    const sb = scoreRow(b);
    return sb - sa;
  });
}

function withSelectionReason(row) {
  return {
    ...row,
    selection_reason: inferSelectionReason(row),
    selection_priority_score: scoreRow(row),
  };
}

function inferSelectionReason(row) {
  if (row.doc_family === 'seat_matrix') return 'core seat source';
  if (row.doc_family === 'result') return 'core allotment source';
  if (row.doc_family === 'vacancy') return 'core vacancy source';
  if (row.doc_family === 'schedule') return 'core timeline source';
  return 'important operational notice';
}

async function readNdjson(filePath) {
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath, 'utf8')
      .pipe(split2())
      .on('data', (line) => {
        const text = String(line || '').trim();
        if (!text) return;
        rows.push(JSON.parse(text));
      })
      .on('error', reject)
      .on('end', resolve);
  });
  return rows;
}

function countBy(rows, key) {
  const out = {};
  for (const row of rows) {
    const k = row[key] || 'unknown';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function norm(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
