#!/usr/bin/env node

/**
 * MCC UG seat-matrix normalized splitter
 *
 * Goal:
 * - Split normalized MCC UG seat-matrix rows into:
 *   1) production-safe rows
 *   2) needs-review rows
 * - Produce meta counts for CEI upload decisions
 *
 * Safe slice rule (v1):
 * - parse_status === "structured_partial"
 * - confidence_band === "high"
 *
 * Everything else goes to review.
 *
 * Install:
 *   npm i fs-extra minimist split2
 *
 * Usage:
 *   node mcc_ug_split_seat_matrix_safe_review.js --dir=./output/mcc_ug_selected_docs
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
const INPUT_PATH = path.join(PARSED_DIR, 'mcc_ug_seat_matrix_normalized.ndjson');
const SAFE_PATH = path.join(PARSED_DIR, 'mcc_ug_seat_matrix_safe.ndjson');
const REVIEW_PATH = path.join(PARSED_DIR, 'mcc_ug_seat_matrix_needs_review.ndjson');
const META_PATH = path.join(PARSED_DIR, 'mcc_ug_seat_matrix_split.meta.json');

async function main() {
  if (!(await fs.pathExists(INPUT_PATH))) {
    throw new Error(`Missing ${INPUT_PATH}`);
  }

  await fs.writeFile(SAFE_PATH, '', 'utf8');
  await fs.writeFile(REVIEW_PATH, '', 'utf8');

  const safeStream = fs.createWriteStream(SAFE_PATH, { encoding: 'utf8' });
  const reviewStream = fs.createWriteStream(REVIEW_PATH, { encoding: 'utf8' });

  const summary = {
    input_path: INPUT_PATH,
    safe_path: SAFE_PATH,
    review_path: REVIEW_PATH,
    started_at: new Date().toISOString(),
    rows_read: 0,
    safe_rows_written: 0,
    review_rows_written: 0,
    safe_by_round: {},
    safe_by_course_bucket: {},
    safe_by_category: {},
    review_by_parse_status: {},
    review_by_confidence_band: {},
  };

  await new Promise((resolve, reject) => {
    fs.createReadStream(INPUT_PATH, 'utf8')
      .pipe(split2())
      .on('data', (line) => {
        try {
          const text = String(line || '').trim();
          if (!text) return;

          const row = JSON.parse(text);
          summary.rows_read += 1;

          const isSafe = row.parse_status === 'structured_partial' && row.confidence_band === 'high';

          if (isSafe) {
            safeStream.write(JSON.stringify(row) + '\n');
            summary.safe_rows_written += 1;
            inc(summary.safe_by_round, normalizeKey(row.round_inferred));
            inc(summary.safe_by_course_bucket, normalizeKey(row.course_bucket_inferred));
            inc(summary.safe_by_category, normalizeKey(row.category_canonical));
          } else {
            reviewStream.write(JSON.stringify(row) + '\n');
            summary.review_rows_written += 1;
            inc(summary.review_by_parse_status, normalizeKey(row.parse_status));
            inc(summary.review_by_confidence_band, normalizeKey(row.confidence_band));
          }
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject)
      .on('end', resolve);
  });

  await new Promise((resolve, reject) => safeStream.end((err) => err ? reject(err) : resolve()));
  await new Promise((resolve, reject) => reviewStream.end((err) => err ? reject(err) : resolve()));

  summary.finished_at = new Date().toISOString();
  await fs.writeJson(META_PATH, summary, { spaces: 2 });

  console.log('MCC UG seat-matrix split complete');
  console.log(JSON.stringify({
    rows_read: summary.rows_read,
    safe_rows_written: summary.safe_rows_written,
    review_rows_written: summary.review_rows_written,
    safe_path: SAFE_PATH,
    review_path: REVIEW_PATH,
  }, null, 2));
}

function inc(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

function normalizeKey(value) {
  const text = String(value || '').trim();
  return text || 'unknown';
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
