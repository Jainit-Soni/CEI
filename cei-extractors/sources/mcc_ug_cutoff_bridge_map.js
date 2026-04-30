#!/usr/bin/env node

/**
 * MCC UG cutoff bridge mapper
 * Links aggregated closing ranks to CEI stable IDs using existing bridge metadata.
 */

const fs = require('fs-extra');
const path = require('path');

const BRIDGE_PATH = 'E:/CMAT-PROBLEM/cei-extractors/output/mcc_bridge_audit/mcc_identity_bridge.ndjson';
const INPUT_PATH = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_results/mcc_ug_closing_ranks_v2.ndjson';
const OUTPUT_PATH = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_results/mcc_ug_cutoffs_mapped.ndjson';

async function main() {
  if (!(await fs.pathExists(BRIDGE_PATH))) {
    throw new Error(`Missing ${BRIDGE_PATH}`);
  }
  if (!(await fs.pathExists(INPUT_PATH))) {
    throw new Error(`Missing ${INPUT_PATH}`);
  }

  console.log('Loading bridge...');
  const bridgeLines = (await fs.readFile(BRIDGE_PATH, 'utf8')).split('\n').filter(Boolean);
  const bridgeMap = new Map(); // Map clean_name to entry

  for (const line of bridgeLines) {
    const entry = JSON.parse(line);
    if (entry.clean_name) {
      bridgeMap.set(entry.clean_name.toLowerCase(), entry);
    }
  }
  console.log(`Loaded ${bridgeMap.size} bridge entries.`);

  console.log('Mapping cutoffs...');
  const cutoffLines = (await fs.readFile(INPUT_PATH, 'utf8')).split('\n').filter(Boolean);
  
  let mappedCount = 0;
  const out = [];

  for (const line of cutoffLines) {
    const cutoff = JSON.parse(line);
    const rawName = cutoff.institute_raw;
    const cleanName = normalizeName(rawName);
    
    // Exact match on clean name
    let match = bridgeMap.get(cleanName.toLowerCase());

    if (!match) {
        // Try substring match or other heuristics
        for (const [bridgeClean, entry] of bridgeMap) {
            if (cleanName.toLowerCase().includes(bridgeClean.toLowerCase()) || bridgeClean.toLowerCase().includes(cleanName.toLowerCase())) {
                match = entry;
                break;
            }
        }
    }

    if (match) {
        out.push({
            ...cutoff,
            institution_id: match.target_id,
            institution_name_canonical: match.target_name,
            match_confidence: match.confidence,
            is_resolved: true
        });
        mappedCount++;
    } else {
        out.push({
            ...cutoff,
            institution_id: null,
            is_resolved: false
        });
    }
  }

  await fs.writeFile(OUTPUT_PATH, out.map(o => JSON.stringify(o)).join('\n') + '\n', 'utf8');
  console.log(`Mapped ${mappedCount} / ${cutoffLines.length} cutoffs.`);
}

function normalizeName(name) {
    return String(name || '')
      .replace(/\s+/g, ' ')
      .replace(/,.*$/, '') // Usually MCC results have address after first comma
      .replace(/\d{6}/g, '')
      .replace(/\(.*\)/g, '')
      .trim();
}

main().catch(console.error);
