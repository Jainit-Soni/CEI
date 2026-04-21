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
const INPUT_PATH = path.join(PARSED_DIR, 'mcc_ug_special_stray_block_rows_v6b_cleaned.ndjson');
const OUTPUT_PATH = path.join(PARSED_DIR, 'mcc_ug_special_stray_block_rows_final.ndjson');
const META_PATH = path.join(PARSED_DIR, 'mcc_ug_special_stray_block_rows_final.meta.json');

const OVERRIDES = {
  '200143': {
    institution_name_guess: 'Medical College, Bhavnagar',
  },
};

async function main() {
  if (!(await fs.pathExists(INPUT_PATH))) {
    throw new Error(`Missing ${INPUT_PATH}`);
  }

  await fs.writeFile(OUTPUT_PATH, '', 'utf8');

  const summary = {
    input_path: INPUT_PATH,
    output_path: OUTPUT_PATH,
    generated_at: new Date().toISOString(),
    rows_read: 0,
    rows_written: 0,
    rows_overridden: 0,
    overridden_codes: {},
  };

  const out = fs.createWriteStream(OUTPUT_PATH, { encoding: 'utf8' });

  await new Promise((resolve, reject) => {
    fs.createReadStream(INPUT_PATH, 'utf8')
      .pipe(split2())
      .on('data', (line) => {
        try {
          const text = String(line || '').trim();
          if (!text) return;

          const row = JSON.parse(text);
          summary.rows_read += 1;

          const code = String(row.institution_code_raw || '').trim();
          const override = OVERRIDES[code];

          if (override) {
            row.institution_name_guess_before_final_override = row.institution_name_guess;
            row.institution_name_guess = override.institution_name_guess;
            summary.rows_overridden += 1;
            summary.overridden_codes[code] = (summary.overridden_codes[code] || 0) + 1;
          }

          row.entity_key = [
            'MCC',
            'MCC_UG',
            String(row.round_inferred || '').toLowerCase().trim(),
            String(row.institution_code_raw || '').toLowerCase().trim(),
            String(row.institution_name_guess || '').toLowerCase().trim(),
            String(row.quota_raw || '').toLowerCase().trim(),
            String(row.course_name_raw || '').toLowerCase().trim(),
            String(row.category_code_raw || '').toLowerCase().trim(),
            row.seat_count ?? '',
          ].join('||');

          row.source_row_fingerprint = [
            row.entity_key,
            String(row.raw_line || '').toLowerCase().replace(/\s+/g, ' ').trim(),
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

  await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  await fs.writeJson(META_PATH, summary, { spaces: 2 });

  console.log('MCC UG final override pass complete');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});