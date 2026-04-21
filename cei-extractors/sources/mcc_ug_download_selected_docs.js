#!/usr/bin/env node

/**
 * MCC UG selected-doc downloader
 *
 * Goal:
 * - Download only the docs selected from mcc_ug_documents_selected.ndjson
 * - Avoid bulk PDF dumping
 * - Save a compact local archive with manifest + download status
 *
 * Install:
 *   npm i fs-extra minimist
 *
 * Usage:
 *   node mcc_ug_download_selected_docs.js \
 *     --in=./output/mcc_ug_documents_selected.ndjson \
 *     --dir=./output/mcc_ug_selected_docs
 */

const fs = require('fs-extra');
const path = require('path');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  string: ['in', 'dir'],
  default: {
    dir: path.resolve(process.cwd(), 'output', 'mcc_ug_selected_docs'),
  },
});

const INPUT_PATH = argv.in ? path.resolve(argv.in) : null;
const TARGET_DIR = path.resolve(argv.dir);
const FILES_DIR = path.join(TARGET_DIR, 'files');
const META_PATH = path.join(TARGET_DIR, 'download_meta.json');
const MANIFEST_COPY_PATH = path.join(TARGET_DIR, 'selected_manifest.ndjson');

if (!INPUT_PATH) {
  console.error('Missing required arg: --in=./output/mcc_ug_documents_selected.ndjson');
  process.exit(1);
}

async function main() {
  const rows = readNdjson(INPUT_PATH);
  await fs.ensureDir(FILES_DIR);
  await fs.copyFile(INPUT_PATH, MANIFEST_COPY_PATH);

  const meta = {
    input_path: INPUT_PATH,
    target_dir: TARGET_DIR,
    started_at: new Date().toISOString(),
    rows_read: rows.length,
    downloaded: 0,
    skipped_existing: 0,
    failed: 0,
    items: [],
  };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const sourceUrl = row.download_url || row.view_url;
    const ext = guessExtension(sourceUrl, row.document_title);
    const safeBase = buildSafeBaseName(row, i + 1);
    const filePath = path.join(FILES_DIR, `${safeBase}.${ext}`);

    const item = {
      index: i + 1,
      document_title: row.document_title || null,
      doc_family: row.doc_family || null,
      round_inferred: row.round_inferred || null,
      course_bucket_inferred: row.course_bucket_inferred || null,
      source_url: sourceUrl || null,
      file_path: filePath,
      status: null,
      size_bytes: null,
      error: null,
    };

    if (!sourceUrl) {
      item.status = 'failed_missing_url';
      item.error = 'No download_url or view_url present';
      meta.failed += 1;
      meta.items.push(item);
      continue;
    }

    if (await fs.pathExists(filePath)) {
      const stat = await fs.stat(filePath);
      item.status = 'skipped_existing';
      item.size_bytes = stat.size;
      meta.skipped_existing += 1;
      meta.items.push(item);
      continue;
    }

    try {
      const response = await fetch(sourceUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(filePath, buffer);

      item.status = 'downloaded';
      item.size_bytes = buffer.length;
      meta.downloaded += 1;
      meta.items.push(item);
    } catch (error) {
      item.status = 'failed';
      item.error = error.message || String(error);
      meta.failed += 1;
      meta.items.push(item);
    }
  }

  meta.finished_at = new Date().toISOString();
  await fs.writeJson(META_PATH, meta, { spaces: 2 });

  console.log('Download complete');
  console.log(JSON.stringify({
    rows_read: meta.rows_read,
    downloaded: meta.downloaded,
    skipped_existing: meta.skipped_existing,
    failed: meta.failed,
    target_dir: TARGET_DIR,
  }, null, 2));
}

function readNdjson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function buildSafeBaseName(row, index) {
  const year = row.inferred_year || 'unknown';
  const family = row.doc_family || 'doc';
  const round = row.round_inferred || 'UNSPECIFIED';
  const title = String(row.document_title || `doc_${index}`)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90);

  return [String(index).padStart(2, '0'), year, family, round, title]
    .filter(Boolean)
    .join('__');
}

function guessExtension(url, title) {
  const raw = `${url || ''} ${title || ''}`.toLowerCase();
  if (raw.includes('.pdf')) return 'pdf';
  if (raw.includes('.xlsx') || raw.includes('excel')) return 'xlsx';
  if (raw.includes('.xls')) return 'xls';
  if (raw.includes('.csv')) return 'csv';
  if (raw.includes('.zip')) return 'zip';
  if (raw.includes('.html') || raw.includes('view')) return 'html';
  return 'bin';
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});