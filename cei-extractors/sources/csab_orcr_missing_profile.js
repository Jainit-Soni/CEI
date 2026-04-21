const fs = require('fs');
const path = require('path');
const readline = require('readline');

const INPUT_FILE = path.join(__dirname, 'output', 'csab_orcr_all_rounds_normalized.ndjson');

const REQUIRED_FIELDS = [
  'authority',
  'source_type',
  'counselling_variant',
  'academic_year',
  'counselling_year',
  'special_round',
  'institute_name_raw',
  'academic_program_name_raw',
  'quota_canonical',
  'seat_type_canonical',
  'gender_canonical',
  'opening_rank',
  'closing_rank',
  'opening_closing_inversion_flag',
  'source_url',
  'provenance',
  'entity_key',
  'source_row_fingerprint'
];

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('INPUT FILE NOT FOUND:', INPUT_FILE);
    process.exit(1);
  }

  const fieldMissingCounts = {};
  const comboCounts = {};
  const comboSamples = {};
  let totalRows = 0;
  let parseErrors = 0;
  let rowsWithMissing = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT_FILE, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const raw = line.trim();
    if (!raw) continue;

    totalRows += 1;

    let doc;
    try {
      doc = JSON.parse(raw);
    } catch (err) {
      parseErrors += 1;
      continue;
    }

    const missingFields = REQUIRED_FIELDS.filter((field) => {
      if (field === 'provenance') {
        return !doc.provenance || typeof doc.provenance !== 'object';
      }
      return isBlank(doc[field]);
    });

    if (missingFields.length === 0) continue;

    rowsWithMissing += 1;

    for (const field of missingFields) {
      fieldMissingCounts[field] = (fieldMissingCounts[field] || 0) + 1;
    }

    const comboKey = missingFields.join(' | ');
    comboCounts[comboKey] = (comboCounts[comboKey] || 0) + 1;

    if (!comboSamples[comboKey]) {
      comboSamples[comboKey] = [];
    }

    if (comboSamples[comboKey].length < 3) {
      comboSamples[comboKey].push({
        authority: doc.authority ?? null,
        counselling_variant: doc.counselling_variant ?? null,
        special_round: doc.special_round ?? null,
        institute_name_raw: doc.institute_name_raw ?? null,
        academic_program_name_raw: doc.academic_program_name_raw ?? null,
        quota_raw: doc.quota_raw ?? null,
        quota_canonical: doc.quota_canonical ?? null,
        seat_type_raw: doc.seat_type_raw ?? null,
        seat_type_canonical: doc.seat_type_canonical ?? null,
        gender_raw: doc.gender_raw ?? null,
        gender_canonical: doc.gender_canonical ?? null,
        opening_rank: doc.opening_rank ?? null,
        closing_rank: doc.closing_rank ?? null,
        entity_key: doc.entity_key ?? null
      });
    }
  }

  const sortedFieldCounts = Object.entries(fieldMissingCounts)
    .sort((a, b) => b[1] - a[1]);

  const sortedComboCounts = Object.entries(comboCounts)
    .sort((a, b) => b[1] - a[1]);

  console.log('\nCSAB ORCR MISSING FIELD PROFILE');
  console.log('Input file            :', INPUT_FILE);
  console.log('Total rows            :', totalRows);
  console.log('Parse errors          :', parseErrors);
  console.log('Rows with missing req :', rowsWithMissing);

  console.log('\nMISSING FIELD COUNTS');
  for (const [field, count] of sortedFieldCounts) {
    console.log(`${field.padEnd(32)} ${count}`);
  }

  console.log('\nTOP MISSING FIELD COMBINATIONS');
  for (const [combo, count] of sortedComboCounts.slice(0, 15)) {
    console.log(`\n[${count}] ${combo}`);
    const samples = comboSamples[combo] || [];
    for (const sample of samples) {
      console.log(JSON.stringify(sample, null, 2));
    }
  }
}

main().catch((err) => {
  console.error('PROFILE FAILED:', err);
  process.exit(1);
});