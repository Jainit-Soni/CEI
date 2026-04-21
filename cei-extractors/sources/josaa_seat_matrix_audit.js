const fs = require('fs');
const path = require('path');
const readline = require('readline');

const INPUT_FILE = path.join(__dirname, 'output', 'josaa_seat_matrix_all_normalized.ndjson');
const REPORT_FILE = path.join(__dirname, 'output', 'josaa_seat_matrix_audit_report.json');

const REQUIRED_FIELDS = [
  'authority',
  'source_type',
  'academic_year',
  'counselling_year',
  'institute_name_normalized',
  'program_name_raw',
  'quota_scope_canonical',
  'seat_pool_canonical',
  'entity_key',
  'source_row_fingerprint',
  'source_url',
  'provenance'
];

const NUMERIC_FIELDS = [
  'open',
  'open_pwd',
  'gen_ews',
  'gen_ews_pwd',
  'sc',
  'sc_pwd',
  'st',
  'st_pwd',
  'obc_ncl',
  'obc_ncl_pwd',
  'total_includes_female_supernumerary',
  'category_sum_excluding_program_totals',
  'program_total_seat_capacity',
  'program_total_female_supernumerary'
];

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function isValidNumber(v) {
  return Number.isFinite(Number(v));
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`INPUT FILE NOT FOUND: ${INPUT_FILE}`);
    process.exit(1);
  }

  const stats = {
    input_file: INPUT_FILE,
    checked_at: new Date().toISOString(),
    rows_total: 0,
    rows_valid_shape: 0,
    rows_with_parse_error: 0,
    rows_with_missing_required_fields: 0,
    rows_with_invalid_numeric_fields: 0,
    rows_with_duplicate_entity_key: 0,
    rows_with_total_mismatch_flag_true: 0,
    unique_entity_keys: 0,
    duplicate_entity_keys: [],
    missing_required_field_samples: [],
    invalid_numeric_field_samples: [],
    parse_error_samples: [],
    mismatch_samples: [],
    seat_pool_counts: {},
    quota_scope_counts: {},
    authority_counts: {},
    source_type_counts: {},
    audit_ok_to_import: false
  };

  const seenEntityKeys = new Set();

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT_FILE, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const raw = line.trim();
    if (!raw) continue;

    stats.rows_total += 1;

    let doc;
    try {
      doc = JSON.parse(raw);
    } catch (err) {
      stats.rows_with_parse_error += 1;
      if (stats.parse_error_samples.length < 10) {
        stats.parse_error_samples.push({
          row_number: stats.rows_total,
          error: err.message,
          raw_preview: raw.slice(0, 500)
        });
      }
      continue;
    }

    const missingFields = REQUIRED_FIELDS.filter((field) => {
      if (field === 'provenance') {
        return !doc.provenance || typeof doc.provenance !== 'object';
      }
      return isBlank(doc[field]);
    });

    if (missingFields.length > 0) {
      stats.rows_with_missing_required_fields += 1;
      if (stats.missing_required_field_samples.length < 10) {
        stats.missing_required_field_samples.push({
          row_number: stats.rows_total,
          entity_key: doc.entity_key || null,
          missing_fields: missingFields
        });
      }
      continue;
    }

    const invalidNumericFields = NUMERIC_FIELDS.filter((field) => !isValidNumber(doc[field]));

    if (invalidNumericFields.length > 0) {
      stats.rows_with_invalid_numeric_fields += 1;
      if (stats.invalid_numeric_field_samples.length < 10) {
        stats.invalid_numeric_field_samples.push({
          row_number: stats.rows_total,
          entity_key: doc.entity_key,
          invalid_numeric_fields: invalidNumericFields,
          values: Object.fromEntries(invalidNumericFields.map((f) => [f, doc[f]]))
        });
      }
      continue;
    }

    if (seenEntityKeys.has(doc.entity_key)) {
      stats.rows_with_duplicate_entity_key += 1;
      if (stats.duplicate_entity_keys.length < 20) {
        stats.duplicate_entity_keys.push(doc.entity_key);
      }
      continue;
    }
    seenEntityKeys.add(doc.entity_key);

    if (doc.total_mismatch_flag === true) {
      stats.rows_with_total_mismatch_flag_true += 1;
      if (stats.mismatch_samples.length < 10) {
        stats.mismatch_samples.push({
          row_number: stats.rows_total,
          entity_key: doc.entity_key,
          total_includes_female_supernumerary: doc.total_includes_female_supernumerary,
          category_sum_excluding_program_totals: doc.category_sum_excluding_program_totals,
          program_total_seat_capacity: doc.program_total_seat_capacity
        });
      }
    }

    const seatPool = String(doc.seat_pool_canonical || 'UNKNOWN');
    const quotaScope = String(doc.quota_scope_canonical || 'UNKNOWN');
    const authority = String(doc.authority || 'UNKNOWN');
    const sourceType = String(doc.source_type || 'UNKNOWN');

    stats.seat_pool_counts[seatPool] = (stats.seat_pool_counts[seatPool] || 0) + 1;
    stats.quota_scope_counts[quotaScope] = (stats.quota_scope_counts[quotaScope] || 0) + 1;
    stats.authority_counts[authority] = (stats.authority_counts[authority] || 0) + 1;
    stats.source_type_counts[sourceType] = (stats.source_type_counts[sourceType] || 0) + 1;

    stats.rows_valid_shape += 1;
  }

  stats.unique_entity_keys = seenEntityKeys.size;
  stats.audit_ok_to_import =
    stats.rows_with_parse_error === 0 &&
    stats.rows_with_missing_required_fields === 0 &&
    stats.rows_with_invalid_numeric_fields === 0 &&
    stats.rows_with_duplicate_entity_key === 0;

  fs.writeFileSync(REPORT_FILE, JSON.stringify(stats, null, 2), 'utf8');

  console.log('\nJOSAA SEAT MATRIX AUDIT COMPLETE');
  console.log('Input file                        :', stats.input_file);
  console.log('Rows total                        :', stats.rows_total);
  console.log('Rows valid shape                  :', stats.rows_valid_shape);
  console.log('Rows with parse error             :', stats.rows_with_parse_error);
  console.log('Rows missing required fields      :', stats.rows_with_missing_required_fields);
  console.log('Rows invalid numeric fields       :', stats.rows_with_invalid_numeric_fields);
  console.log('Rows duplicate entity_key         :', stats.rows_with_duplicate_entity_key);
  console.log('Rows with total_mismatch_flag=true:', stats.rows_with_total_mismatch_flag_true);
  console.log('Unique entity_keys                :', stats.unique_entity_keys);
  console.log('Audit OK to import                :', stats.audit_ok_to_import);
  console.log('Report                            :', REPORT_FILE);

  process.exit(stats.audit_ok_to_import ? 0 : 2);
}

main().catch((err) => {
  console.error('AUDIT FAILED:', err);
  process.exit(1);
});