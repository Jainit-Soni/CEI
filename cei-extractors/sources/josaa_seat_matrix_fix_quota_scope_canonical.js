const fs = require('fs');
const path = require('path');
const readline = require('readline');

const INPUT_FILE = path.join(__dirname, 'output', 'josaa_seat_matrix_all_normalized.ndjson');
const BACKUP_FILE = path.join(__dirname, 'output', 'josaa_seat_matrix_all_normalized.pre_quota_scope_fix.bak.ndjson');
const TEMP_FILE = path.join(__dirname, 'output', 'josaa_seat_matrix_all_normalized.fixed.tmp.ndjson');
const REPORT_FILE = path.join(__dirname, 'output', 'josaa_seat_matrix_quota_scope_fix_report.json');

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

function deriveQuotaScope(rawValue) {
  const raw = cleanSpaces(rawValue);
  if (!raw) {
    return {
      ok: false,
      reason: 'blank_quota_scope_raw'
    };
  }

  const rawLower = raw.toLowerCase();

  if (rawLower === 'all india') {
    return {
      ok: true,
      quota_scope_canonical: 'ALL_INDIA',
      quota_scope_mode: 'ALL_INDIA',
      quota_scope_state_key: null
    };
  }

  const otherThanMatch = raw.match(/^other\s+than\s+(.+)$/i);
  if (otherThanMatch) {
    const stateRaw = cleanSpaces(otherThanMatch[1]);
    const stateKey = toConstKey(stateRaw);
    if (!stateKey) {
      return {
        ok: false,
        reason: 'blank_state_after_other_than'
      };
    }
    return {
      ok: true,
      quota_scope_canonical: `OTHER_THAN_STATE_${stateKey}`,
      quota_scope_mode: 'OTHER_THAN_STATE',
      quota_scope_state_key: stateKey
    };
  }

  const stateKey = toConstKey(raw);
  if (!stateKey) {
    return {
      ok: false,
      reason: 'unmappable_state_value'
    };
  }

  return {
    ok: true,
    quota_scope_canonical: `STATE_${stateKey}`,
    quota_scope_mode: 'STATE',
    quota_scope_state_key: stateKey
  };
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
    rows_already_had_quota_scope_canonical: 0,
    rows_missing_quota_scope_canonical: 0,
    rows_fixed: 0,
    rows_unfixable: 0,
    rows_fixed_by_type: {
      ALL_INDIA: 0,
      STATE: 0,
      OTHER_THAN_STATE: 0
    },
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

    const existingCanonical = cleanSpaces(doc.quota_scope_canonical);
    if (existingCanonical) {
      stats.rows_already_had_quota_scope_canonical += 1;
      out.write(JSON.stringify(doc) + '\n');
      stats.rows_written += 1;
      continue;
    }

    stats.rows_missing_quota_scope_canonical += 1;

    const derived = deriveQuotaScope(doc.quota_scope_raw);

    if (!derived.ok) {
      stats.rows_unfixable += 1;
      if (stats.unfixable_samples.length < 10) {
        stats.unfixable_samples.push({
          row_number: stats.rows_total,
          entity_key: doc.entity_key || null,
          quota_scope_raw: doc.quota_scope_raw || null,
          reason: derived.reason
        });
      }
      out.write(JSON.stringify(doc) + '\n');
      stats.rows_written += 1;
      continue;
    }

    doc.quota_scope_canonical = derived.quota_scope_canonical;

    // Helpful, non-destructive helper fields for future filtering.
    // These do not replace raw truth; they just make querying deterministic.
    doc.quota_scope_mode = derived.quota_scope_mode;
    doc.quota_scope_state_key = derived.quota_scope_state_key;

    stats.rows_fixed += 1;
    stats.rows_fixed_by_type[derived.quota_scope_mode] =
      (stats.rows_fixed_by_type[derived.quota_scope_mode] || 0) + 1;

    out.write(JSON.stringify(doc) + '\n');
    stats.rows_written += 1;
  }

  await new Promise((resolve, reject) => {
    out.end(() => resolve());
    out.on('error', reject);
  });

  fs.renameSync(TEMP_FILE, INPUT_FILE);
  fs.writeFileSync(REPORT_FILE, JSON.stringify(stats, null, 2), 'utf8');

  console.log('\nJOSAA SEAT MATRIX QUOTA SCOPE FIX COMPLETE');
  console.log('Input file                             :', stats.input_file);
  console.log('Backup file                            :', stats.backup_file);
  console.log('Rows total                             :', stats.rows_total);
  console.log('Rows written                           :', stats.rows_written);
  console.log('Rows parse error                       :', stats.rows_parse_error);
  console.log('Rows already had quota_scope_canonical :', stats.rows_already_had_quota_scope_canonical);
  console.log('Rows missing quota_scope_canonical     :', stats.rows_missing_quota_scope_canonical);
  console.log('Rows fixed                             :', stats.rows_fixed);
  console.log('Rows unfixable                         :', stats.rows_unfixable);
  console.log('Rows fixed as ALL_INDIA                :', stats.rows_fixed_by_type.ALL_INDIA);
  console.log('Rows fixed as STATE                    :', stats.rows_fixed_by_type.STATE);
  console.log('Rows fixed as OTHER_THAN_STATE         :', stats.rows_fixed_by_type.OTHER_THAN_STATE);
  console.log('Report                                 :', REPORT_FILE);

  process.exit(stats.rows_parse_error === 0 && stats.rows_unfixable === 0 ? 0 : 2);
}

main().catch((err) => {
  console.error('FIX FAILED:', err);
  process.exit(1);
});