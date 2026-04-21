#!/usr/bin/env node

/**
 * MCC Build Manual Bridge Review
 * =============================
 * Flattens ambiguous and missing bridge results into a reviewer-friendly format.
 */

const fs = require('fs-extra');
const path = require('path');
const minimist = require('minimist');
const split2 = require('split2');

const argv = minimist(process.argv.slice(2), {
  string: ['dir'],
  default: {
    dir: 'E:/CMAT-PROBLEM/cei-extractors/output/mcc_bridge_audit'
  }
});

const TARGET_DIR = path.resolve(argv.dir);
const AMBIGUOUS_PATH = path.join(TARGET_DIR, 'mcc_identity_ambiguous.ndjson');
const MISSING_PATH = path.join(TARGET_DIR, 'mcc_identity_missing.ndjson');

const REVIEW_NDJSON = path.join(TARGET_DIR, 'mcc_identity_manual_review.ndjson');
const REVIEW_CSV = path.join(TARGET_DIR, 'mcc_identity_manual_review.csv');
const LEGACY_GEMS = path.join(TARGET_DIR, 'mcc_missing_in_v2_but_present_in_legacy.ndjson');

async function main() {
  if (!(await fs.pathExists(TARGET_DIR))) throw new Error(`Dir not found: ${TARGET_DIR}`);

  console.log(`Building review files in: ${TARGET_DIR}`);

  const reviewItems = [];
  const legacyGems = [];

  // 1. Process Ambiguous
  if (await fs.pathExists(AMBIGUOUS_PATH)) {
    await processFile(AMBIGUOUS_PATH, reviewItems, legacyGems, 'ambiguous');
  }

  // 2. Process Missing
  if (await fs.pathExists(MISSING_PATH)) {
    await processFile(MISSING_PATH, reviewItems, legacyGems, 'missing');
  }

  // 3. Write NDJSON
  await fs.writeFile(REVIEW_NDJSON, reviewItems.map(x => JSON.stringify(x)).join('\n') + '\n', 'utf8');

  // 4. Write CSV
  const csvHeaders = [
    'mcc_id', 'mcc_name_raw', 'clean_name', 'confidence', 'status',
    'cand1_id', 'cand1_name', 'cand1_score', 'cand1_source',
    'cand2_id', 'cand2_name', 'cand2_score', 'cand2_source',
    'cand3_id', 'cand3_name', 'cand3_score', 'cand3_source'
  ];
  const csvRows = reviewItems.map(item => {
    return csvHeaders.map(h => {
        let val = item[h] || '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
            val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
    }).join(',');
  });
  await fs.writeFile(REVIEW_CSV, [csvHeaders.join(','), ...csvRows].join('\n'), 'utf8');

  // 5. Write Legacy Gems
  await fs.writeFile(LEGACY_GEMS, legacyGems.map(x => JSON.stringify(x)).join('\n') + '\n', 'utf8');

  console.log(`Review Files Generated:`);
  console.log(`- NDJSON: ${REVIEW_NDJSON}`);
  console.log(`- CSV:    ${REVIEW_CSV}`);
  console.log(`- Gems:   ${LEGACY_GEMS} (${legacyGems.length} items)`);
}

async function processFile(filePath, reviewItems, legacyGems, status) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath, 'utf8')
      .pipe(split2())
      .on('data', (line) => {
        if (!line) return;
        try {
          const row = JSON.parse(line);
          const candidates = row.candidates || [];
          
          const reviewItem = {
            mcc_id: row.mcc_id || '',
            mcc_name_raw: row.mcc_name_raw || '',
            clean_name: row.clean_name || '',
            confidence: row.confidence || 0,
            status: status,
            cand1_id: candidates[0]?.id || '',
            cand1_name: candidates[0]?.name || '',
            cand1_score: candidates[0]?.score || '',
            cand1_source: candidates[0]?.source || '',
            cand2_id: candidates[1]?.id || '',
            cand2_name: candidates[1]?.name || '',
            cand2_score: candidates[1]?.score || '',
            cand2_source: candidates[1]?.source || '',
            cand3_id: candidates[2]?.id || '',
            cand3_name: candidates[2]?.name || '',
            cand3_score: candidates[2]?.score || '',
            cand3_source: candidates[2]?.source || '',
          };
          reviewItems.push(reviewItem);

          // Check for legacy gems (Match in legacy but none in v2)
          const hasV2 = candidates.some(c => c.source === 'v2');
          const topLegacy = candidates.find(c => c.source === 'legacy');
          if (!hasV2 && topLegacy && topLegacy.score > 0.75) {
            legacyGems.push({
                ...row,
                top_legacy_candidate: topLegacy
            });
          }

        } catch (e) {}
      })
      .on('error', reject)
      .on('end', resolve);
  });
}

main().catch(console.error);
