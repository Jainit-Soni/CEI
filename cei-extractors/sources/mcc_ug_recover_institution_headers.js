#!/usr/bin/env node

/**
 * MCC UG Institution Header Recovery
 * ==================================
 * Post-processes the "safe" seat matrix NDJSON to synthesize cleaner 
 * institution identities for the bridge logic.
 */

const fs = require('fs-extra');
const path = require('path');
const minimist = require('minimist');
const split2 = require('split2');

const argv = minimist(process.argv.slice(2), {
  string: ['in', 'out'],
  default: {
    in: 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_seat_matrix/mcc_ug_seat_matrix_safe.ndjson',
    out: 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_seat_matrix/mcc_ug_seat_matrix_clean_headers.ndjson'
  }
});

const INPUT_PATH = path.resolve(argv.in);
const OUTPUT_PATH = path.resolve(argv.out);

const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Delhi',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand',
  'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal'
];

async function main() {
  if (!(await fs.pathExists(INPUT_PATH))) {
    throw new Error(`Input file not found: ${INPUT_PATH}`);
  }

  await fs.ensureDir(path.dirname(OUTPUT_PATH));
  const out = fs.createWriteStream(OUTPUT_PATH, { encoding: 'utf8' });

  let count = 0;

  await new Promise((resolve, reject) => {
    fs.createReadStream(INPUT_PATH, 'utf8')
      .pipe(split2())
      .on('data', (line) => {
        if (!line) return;
        try {
          const row = JSON.parse(line);
          const recovered = recoverHeaders(row);
          
          out.write(JSON.stringify({ ...row, ...recovered }) + '\n');
          count++;
        } catch (e) {
          console.error('Error parsing line:', e.message);
        }
      })
      .on('error', reject)
      .on('end', resolve);
  });

  await new Promise((resolve) => out.end(resolve));
  console.log(`Recovery complete. Processed ${count} rows.`);
}

function recoverHeaders(row) {
  const prevLine = row.provenance?.previous_line || '';
  const rawLine = row.institution_name_raw || '';
  
  // 1. Identify raw header search space
  let headerRaw = '';
  let recoveredFrom = 'institution_name_raw';
  
  if (prevLine && !/^\d+$/.test(prevLine) && !prevLine.match(/All India|Quota|Branch/i)) {
    headerRaw = prevLine;
    recoveredFrom = 'previous_line';
  } else {
    headerRaw = rawLine;
    recoveredFrom = 'institution_name_raw';
  }

  // 2. Extract MCC ID
  const mccIdMatch = rawLine.match(/\((\d{6})\)/) || prevLine.match(/\((\d{6})\)/);
  const mccId = mccIdMatch ? mccIdMatch[1] : null;

  // 3. Clean Name
  let cleanName = headerRaw;
  let notes = [];

  // Strip obvious noise
  if (cleanName.includes('(')) {
    cleanName = cleanName.replace(/\(\d{6}\)/g, '').trim();
    notes.push('Removed parenthesized code');
  }
  
  if (cleanName.match(/\d{6}/)) {
    cleanName = cleanName.replace(/\b\d{6}\b/g, '').trim();
    notes.push('Removed pincode');
  }

  // Strip state scaffolding but be careful
  for (const state of STATES) {
    if (cleanName.startsWith(state)) {
      const rest = cleanName.slice(state.length).trim();
      // Only strip if the rest looks like a proper name or keyword
      if (rest.match(/^[A-Z]{2}/) || rest.match(/medical|college|aiims|institute|hospital/i)) {
         cleanName = rest;
         notes.push(`Stripped state prefix: ${state}`);
         break;
      }
    }
  }

  // Final polishing
  cleanName = cleanName
    .replace(/All India|Deemed\/Paid Seats Quota|Non-Resident Indian|Open Seat Quota|Management Quota/gi, '')
    .replace(/,?\s*[A-Z]{2},?\s*$/g, '') // Trailing state abbreviations
    .replace(/,+/g, ',')
    .replace(/^\s*,/g, '')
    .replace(/,\s*$/g, '')
    .trim();

  // 4. Confidence
  let confidence = 'low';
  if (cleanName.match(/medical|college|aiims|institute|hospital/i)) {
    confidence = mccId ? 'high' : 'medium';
  } else if (mccId) {
    confidence = 'medium';
  }

  return {
    institution_header_raw: headerRaw,
    institution_name_clean: cleanName,
    institution_name_recovered_from: recoveredFrom,
    header_confidence: confidence,
    recovery_notes: notes.join('; '),
    mcc_id: mccId
  };
}

main().catch(console.error);
