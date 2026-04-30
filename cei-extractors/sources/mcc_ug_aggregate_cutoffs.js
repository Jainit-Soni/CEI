#!/usr/bin/env node

/**
 * MCC UG cutoff aggregator (v2)
 * Converts raw tuples into closing ranks per (Institute, Category, Round).
 * Includes sanity checks for rank values.
 */

const fs = require('fs-extra');
const path = require('path');

const INPUT_PATH = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_results/cutoff_tuples_v2.ndjson';
const OUTPUT_PATH = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_results/mcc_ug_closing_ranks_v2.ndjson';

async function main() {
  if (!(await fs.pathExists(INPUT_PATH))) {
    throw new Error(`Missing ${INPUT_PATH}`);
  }

  const lines = (await fs.readFile(INPUT_PATH, 'utf8')).split('\n').filter(Boolean);
  const groups = new Map();

  let skippedCount = 0;

  for (const line of lines) {
    const tuple = JSON.parse(line);
    
    // Sanity check for Rank (NEET UG ranks stop around 24-25L)
    if (tuple.rank > 2000000) {
        skippedCount++;
        continue;
    }
    
    // Sanity check for Institute
    if (!tuple.institute || tuple.institute.length < 5 || /^\d+$/.test(tuple.institute)) {
        skippedCount++;
        continue;
    }

    // Only consider "Allotted" or "Upgraded" or "Reported" as valid allotments
    if (!/Allotted|Upgraded|Reported|Admitted|No Upgradation/i.test(tuple.status)) continue;

    // Normalize Category
    const category = normalizeCategory(tuple.category);
    if (!category) continue;

    const key = `${tuple.institute}||${tuple.course}||${tuple.quota}||${category}||${tuple.round}`;
    
    if (!groups.has(key)) {
      groups.set(key, {
        institute_raw: tuple.institute,
        course: tuple.course,
        quota: tuple.quota,
        category: category,
        round: tuple.round,
        closing_rank: tuple.rank,
        count: 1
      });
    } else {
      const existing = groups.get(key);
      // We want the CLOSING rank (MAX rank)
      if (tuple.rank > existing.closing_rank) {
        existing.closing_rank = tuple.rank;
      }
      existing.count += 1;
    }
  }

  const out = Array.from(groups.values());
  await fs.writeFile(OUTPUT_PATH, out.map(o => JSON.stringify(o)).join('\n') + '\n', 'utf8');

  console.log(`Aggregated ${lines.length} tuples into ${out.length} closing rank records.`);
  console.log(`Skipped ${skippedCount} suspicious tuples.`);
}

function normalizeCategory(cat) {
  const t = String(cat || '').toUpperCase();
  let base = null;
  if (t.includes('OPEN') && t.includes('GENERAL')) base = 'OPEN';
  else if (t.includes('OPEN') && t.includes('OBC')) base = 'OBC';
  else if (t.includes('OPEN') && t.includes('SC')) base = 'SC';
  else if (t.includes('OPEN') && t.includes('ST')) base = 'ST';
  else if (t.includes('OPEN') && t.includes('EWS')) base = 'EWS';
  else if (t.includes('OBC')) base = 'OBC';
  else if (t.includes('SC')) base = 'SC';
  else if (t.includes('ST')) base = 'ST';
  else if (t.includes('EWS')) base = 'EWS';
  else if (t.includes('GENERAL')) base = 'OPEN';
  else if (t.includes('GN')) base = 'OPEN';
  else if (t.includes('BC')) base = 'OBC';
  else if (t.includes('EW')) base = 'EWS';
  
  if (!base) return null;
  if (t.includes('PWD') || t.includes('PH')) return base + '_PWD';
  return base;
}

main().catch(console.error);
