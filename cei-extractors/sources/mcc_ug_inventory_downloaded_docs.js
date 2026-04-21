#!/usr/bin/env node

/**
 * MCC UG downloaded-doc inventory
 *
 * Goal:
 * - Inspect the selected downloaded docs folder
 * - Read download_meta.json
 * - Classify files by extension and doc family
 * - Produce a compact inventory report before parsing
 *
 * Why this exists:
 * - Do not start parsing blindly
 * - First know what formats you actually have: pdf / html / xlsx / xls / csv
 * - Then choose the highest-yield parser first
 *
 * Install:
 *   npm i fs-extra minimist
 *
 * Usage:
 *   node mcc_ug_inventory_downloaded_docs.js --dir=./output/mcc_ug_selected_docs
 */

const fs = require('fs-extra');
const path = require('path');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  string: ['dir'],
  default: {
    dir: path.resolve(process.cwd(), 'output', 'mcc_ug_selected_docs'),
  },
});

const TARGET_DIR = path.resolve(argv.dir);
const META_PATH = path.join(TARGET_DIR, 'download_meta.json');
const OUTPUT_PATH = path.join(TARGET_DIR, 'inventory.json');

async function main() {
  if (!(await fs.pathExists(META_PATH))) {
    throw new Error(`Missing ${META_PATH}`);
  }

  const meta = await fs.readJson(META_PATH);
  const items = Array.isArray(meta.items) ? meta.items : [];

  const inventory = {
    target_dir: TARGET_DIR,
    generated_at: new Date().toISOString(),
    total_items: items.length,
    downloaded_items: items.filter((x) => x.status === 'downloaded' || x.status === 'skipped_existing').length,
    by_status: countBy(items, (x) => x.status || 'unknown'),
    by_extension: countBy(items, (x) => extensionOf(x.file_path)),
    by_doc_family: countBy(items, (x) => x.doc_family || 'unknown'),
    by_round: countBy(items, (x) => x.round_inferred || 'unknown'),
    largest_files: items
      .filter((x) => Number.isFinite(x.size_bytes))
      .sort((a, b) => b.size_bytes - a.size_bytes)
      .slice(0, 10)
      .map(compactItem),
    recommended_parse_order: buildRecommendedParseOrder(items),
  };

  await fs.writeJson(OUTPUT_PATH, inventory, { spaces: 2 });
  console.log('Inventory complete');
  console.log(JSON.stringify(inventory, null, 2));
}

function buildRecommendedParseOrder(items) {
  const good = items.filter((x) => x.status === 'downloaded' || x.status === 'skipped_existing');

  const seatMatrix = good.filter((x) => x.doc_family === 'seat_matrix').map(compactItem);
  const results = good.filter((x) => x.doc_family === 'result').map(compactItem);
  const vacancy = good.filter((x) => x.doc_family === 'vacancy').map(compactItem);
  const schedule = good.filter((x) => x.doc_family === 'schedule').map(compactItem);

  return {
    first: seatMatrix,
    second: results,
    third: vacancy,
    fourth: schedule,
  };
}

function compactItem(x) {
  return {
    document_title: x.document_title || null,
    doc_family: x.doc_family || null,
    round_inferred: x.round_inferred || null,
    file_path: x.file_path || null,
    extension: extensionOf(x.file_path),
    size_bytes: Number.isFinite(x.size_bytes) ? x.size_bytes : null,
  };
}

function extensionOf(filePath) {
  const ext = String(path.extname(filePath || '') || '').toLowerCase().replace(/^\./, '');
  return ext || 'unknown';
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
