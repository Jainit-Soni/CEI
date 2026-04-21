const fs = require('fs');
const path = require('path');
const readline = require('readline');

const INPUT_FILE = path.join(__dirname, 'output', 'csab_orcr_all_rounds_normalized.ndjson');
const BACKUP_FILE = path.join(__dirname, 'output', 'csab_orcr_all_rounds_normalized.pre_canonical_fix.bak.ndjson');
const TEMP_FILE = path.join(__dirname, 'output', 'csab_orcr_all_rounds_normalized.fixed.tmp.ndjson');
const REPORT_FILE = path.join(__dirname, 'output', 'csab_orcr_canonical_fix_report.json');

function cleanSpaces(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function toConstKey(s) {
  return cleanSpaces(s)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function deriveSeatTypeCanonical(rawValue) {
  const raw = cleanSpaces(rawValue);
  if (!raw) return { ok: false, reason: 'blank_seat_type_raw' };

  const canonical = toConstKey(raw);
  if (!canonical) return { ok: false, reason: 'unmappable_seat_type_raw' };

  return { ok: true, canonical };
}

function deriveQuotaCanonical(rawValue) {
  const raw = cleanSpaces(rawValue);
  if (!raw) return { ok: false, reason: 'blank_quota_raw' };

  const canonical = toConstKey(raw);
  if (!canonical) return { ok: false, reason: 'unmappable_quota_raw' };

  return { ok: true, canonical };
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('INPUT FILE NOT FOUND:', INPUT_FILE);
    process.exit(1);
  }

  if (!fs.existsSync(BACKUP_FILE)) {
    fs.copyFileSync(INPUT_FILE, BACKUP_FILE);
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT_FILE, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  const out = fs.createWriteStream(TEMP_FILE, { encoding: 'utf8' });

  const stats = {
    input_file: INPUT_FILE,
    backup_file: BACKUP_FILE,
    temp_file: TEMP_FILE,
    fixed_at: new Date().toISOString(),
    rows_total: 0,
    rows_written: 0,
    rows_parse_error: 0,

    rows_already_had_seat_type_canonical: 0,
    rows_missing_seat_type_canonical: 0,
    rows_fixed_seat_type_canonical: 0,

    rows_already_had_quota_canonical: 0,
    rows_missing_quota_canonical: 0,
    rows_fixed_quota_canonical: 0,

    rows_fixed_any_field: 0,
    rows_unfixable: 0,
    unfixable_samples: []
  };

  for await (const line of rl) {
    const rawLine = line.trim();
    if (!rawLine) continue;

    stats.rows_total += 1;

    let doc;
    try {
      doc = JSON.parse(rawLine);
    } catch (err) {
      stats.rows_parse_error += 1;
      if (stats.unfixable_samples.length < 10) {
        stats.unfixable_samples.push({
          row_number: stats.rows_total,
          reason: 'parse_error',
          error: err.message,
          raw_preview: rawLine.slice(0, 500)
        });
      }
      continue;
    }

    let rowFixed = false;
    let rowUnfixable = false;
    const rowReasons = [];

    const existingSeatTypeCanonical = cleanSpaces(doc.seat_type_canonical);
    if (existingSeatTypeCanonical) {
      stats.rows_already_had_seat_type_canonical += 1;
    } else {
      stats.rows_missing_seat_type_canonical += 1;
      const derivedSeat = deriveSeatTypeCanonical(doc.seat_type_raw);
      if (derivedSeat.ok) {
        doc.seat_type_canonical = derivedSeat.canonical;
        stats.rows_fixed_seat_type_canonical += 1;
        rowFixed = true;
      } else {
        rowUnfixable = true;
        rowReasons.push(derivedSeat.reason);
      }
    }

    const existingQuotaCanonical = cleanSpaces(doc.quota_canonical);
    if (existingQuotaCanonical) {
      stats.rows_already_had_quota_canonical += 1;
    } else {
      stats.rows_missing_quota_canonical += 1;
      const derivedQuota = deriveQuotaCanonical(doc.quota_raw);
      if (derivedQuota.ok) {
        doc.quota_canonical = derivedQuota.canonical;
        stats.rows_fixed_quota_canonical += 1;
        rowFixed = true;
      } else {
        rowUnfixable = true;
        rowReasons.push(derivedQuota.reason);
      }
    }

    if (rowFixed) {
      stats.rows_fixed_any_field += 1;
    }

    if (rowUnfixable) {
      stats.rows_unfixable += 1;
      if (stats.unfixable_samples.length < 10) {
        stats.unfixable_samples.push({
          row_number: stats.rows_total,
          entity_key: doc.entity_key || null,
          seat_type_raw: doc.seat_type_raw || null,
          quota_raw: doc.quota_raw || null,
          reasons: rowReasons
        });
      }
    }

    out.write(JSON.stringify(doc) + '\n');
    stats.rows_written += 1;
  }

  await new Promise((resolve, reject) => {
    out.end(() => resolve());
    out.on('error', reject);
  });

  fs.renameSync(TEMP_FILE, INPUT_FILE);
  fs.writeFileSync(REPORT_FILE, JSON.stringify(stats, null, 2), 'utf8');

  console.log('\nCSAB ORCR CANONICAL FIX COMPLETE');
  console.log('Input file                              :', stats.input_file);
  console.log('Backup file                             :', stats.backup_file);
  console.log('Rows total                              :', stats.rows_total);
  console.log('Rows written                            :', stats.rows_written);
  console.log('Rows parse error                        :', stats.rows_parse_error);
  console.log('Rows already had seat_type_canonical    :', stats.rows_already_had_seat_type_canonical);
  console.log('Rows missing seat_type_canonical        :', stats.rows_missing_seat_type_canonical);
  console.log('Rows fixed seat_type_canonical          :', stats.rows_fixed_seat_type_canonical);
  console.log('Rows already had quota_canonical        :', stats.rows_already_had_quota_canonical);
  console.log('Rows missing quota_canonical            :', stats.rows_missing_quota_canonical);
  console.log('Rows fixed quota_canonical              :', stats.rows_fixed_quota_canonical);
  console.log('Rows fixed any field                    :', stats.rows_fixed_any_field);
  console.log('Rows unfixable                          :', stats.rows_unfixable);
  console.log('Report                                  :', REPORT_FILE);

  process.exit(stats.rows_parse_error === 0 && stats.rows_unfixable === 0 ? 0 : 2);
}

main().catch((err) => {
  console.error('FIX FAILED:', err);
  process.exit(1);
});