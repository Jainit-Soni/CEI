#!/usr/bin/env node

/**
 * MCC Medical Identity Bridge (Audit v1)
 * =====================================
 * READ-ONLY script to resolve identities between MCC raw data and CEI core/legacy.
 *
 * Goal:
 * - Extract unique MCC IDs and clean names from seat matrix.
 * - Perform multi-level matching against cei_v2 and cei_legacy.
 * - Output mapping assets for review (No DB modifications).
 */

const fs = require('fs-extra');
const path = require('path');
const { MongoClient } = require('mongodb');
const split2 = require('split2');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  string: ['in', 'outDir'],
  default: {
    in: 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_seat_matrix/mcc_ug_seat_matrix_safe.ndjson',
    outDir: './output/mcc_bridge_audit'
  }
});

const MONGO_URI = 'mongodb://localhost:27017';
const INPUT_PATH = path.resolve(argv.in);
const OUT_DIR = path.resolve(argv.outDir);

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const dbV2 = client.db('cei_v2');
    const dbLegacy = client.db('cei_legacy');

    console.log('--- Phase 1: Preparation ---');
    await fs.ensureDir(OUT_DIR);
    
    console.log('Loading candidates from MongoDB...');
    const v2Institutions = await dbV2.collection('institutions').find({}, { projection: { institution_name: 1, institution_id: 1, state_name: 1 } }).toArray();
    const legacyColleges = await dbLegacy.collection('colleges').find({}, { projection: { name: 1, id: 1, state: 1 } }).toArray();
    
    console.log(`Loaded ${v2Institutions.length} v2 candidates and ${legacyColleges.length} legacy candidates.`);

    console.log('Loading manual overrides...');
    const overrideMap = await loadManualOverrides(OUT_DIR);
    console.log(`Loaded ${overrideMap.size} manual overrides.`);

    console.log('\n--- Phase 2: Source Extraction ---');
    const mccSourceData = await extractUniqueMccEntities(INPUT_PATH);
    console.log(`Found ${mccSourceData.length} unique MCC entities in source.`);

    console.log('\n--- Phase 3: Resolution Core ---');
    const report = {
      total_mcc_entities: mccSourceData.length,
      matched_v2: 0,
      matched_legacy: 0,
      manual_overrides: 0,
      unmatched: 0,
      ambiguous: 0,
      matches: [],
      missing: [],
      ambiguous_list: []
    };

    for (const entity of mccSourceData) {
      const match = resolveEntity(entity, v2Institutions, legacyColleges, overrideMap);
      
      if (match.source === 'manual_override') {
        report.manual_overrides++;
        report.matches.push(match);
      } else if (match.confidence >= 90) {
        if (match.source === 'v2') report.matched_v2++;
        else report.matched_legacy++;
        report.matches.push(match);
      } else if (match.candidates && match.candidates.length > 0) {
        report.ambiguous++;
        report.ambiguous_list.push(match);
      } else {
        report.unmatched++;
        report.missing.push(entity);
      }
    }

    console.log('\n--- Phase 4: Output Generation ---');
    await writeResults(OUT_DIR, report);

    console.log('\n--- Audit Summary ---');
    console.log(`Total Mapped: ${report.matched_v2 + report.matched_legacy + report.manual_overrides}`);
    console.log(`  - Manual Overrides: ${report.manual_overrides}`);
    console.log(`  - v2 Direct: ${report.matched_v2}`);
    console.log(`  - Legacy Only: ${report.matched_legacy}`);
    console.log(`Ambiguous: ${report.ambiguous}`);
    console.log(`Unmatched: ${report.unmatched}`);
    console.log(`Results written to: ${OUT_DIR}`);

  } catch (err) {
    console.error('Fatal Error:', err);
  } finally {
    await client.close();
  }
}

/**
 * Load manual overrides from NDJSON
 */
async function loadManualOverrides(dir) {
  const map = new Map();
  const filePath = path.join(dir, 'mcc_identity_manual_overrides.ndjson');
  if (!(await fs.pathExists(filePath))) return map;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath, 'utf8')
      .pipe(split2())
      .on('data', line => {
        if (!line) return;
        try {
          const row = JSON.parse(line);
          if (row.mcc_id) map.set('ID:' + row.mcc_id, row);
          if (row.mcc_name_raw) map.set('RAW:' + row.mcc_name_raw, row);
        } catch (e) {}
      })
      .on('end', () => resolve(map))
      .on('error', reject);
  });
}

/**
 * Extract unique MCC rows from NDJSON
 */
async function extractUniqueMccEntities(filePath) {
  const entities = new Map();
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(split2())
      .on('data', line => {
        if (!line) return;
        try {
          const doc = JSON.parse(line);
          const raw = doc.institution_name_raw;
          if (!raw || entities.has(raw)) return;

          const mccId = doc.mcc_id || (raw ? (raw.match(/\((\d{6})\)/) || [null, null])[1] : null);

          // Use recovered name if available, otherwise fallback to legacy cleaning
          let cleanName = doc.institution_name_clean || '';
          
          if (!cleanName && raw) {
            // Cleaning logic for raw name (fallback)
            let cleanRaw = raw.replace(/\(\d{6}\)/, '').trim();
            cleanRaw = cleanRaw.replace(/\d{6}/g, '').trim(); 
            cleanRaw = cleanRaw.replace(/All India|Deemed\/Paid Seats Quota|Non-Resident Indian|Open Seat Quota|Management Quota/gi, '').trim();
            cleanRaw = cleanRaw.replace(/,?\s*[A-Z]{2}\s*$/g, '').trim(); 
            cleanRaw = cleanRaw.replace(/,\s*$/g, '').trim();

            // Cleaning logic for provenance.previous_line (primary)
            let cleanPrev = '';
            const prev = doc.provenance?.previous_line || '';
            if (prev && !prev.match(/^\d+$/)) {
              cleanPrev = prev.replace(/^(Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana|Himachal Pradesh|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Andaman and Nicobar Islands|Chandigarh|Dadra and Nagar Haveli and Daman and Diu|Delhi|Jammu and Kashmir|Ladakh|Lakshadweep|Puducherry)\s+/i, '');
              cleanPrev = cleanPrev.replace(/\d{6}/g, '').trim();
              cleanPrev = cleanPrev.replace(/\(\d{6}\)/g, '').trim();
              cleanPrev = cleanPrev.replace(/,\s*$/g, '').trim();
            }
            cleanName = cleanPrev || cleanRaw;
          }

          if (!cleanName) return;

          entities.set(raw, {
            mccId,
            cleanName,
            rawName: raw,
            stateInferred: doc.state_name_raw || null
          });
        } catch (e) {}
      })
      .on('end', () => resolve(Array.from(entities.values())))
      .on('error', reject);
  });
}

/**
 * Multi-level Matching Core
 */
function resolveEntity(entity, v2Pool, legacyPool, overrideMap) {
  const result = {
    mcc_id: entity.mccId,
    mcc_name_raw: entity.rawName,
    clean_name: entity.cleanName,
    confidence: 0,
    target_id: null,
    source: null,
    candidates: []
  };

  // 0. Manual Override Priority
  const override = (entity.mccId && overrideMap.get('ID:' + entity.mccId)) || overrideMap.get('RAW:' + entity.rawName);
  if (override) {
    return {
      ...result,
      confidence: 100,
      target_id: override.resolved_target_id,
      source: 'manual_override',
      review_notes: override.match_reason || 'manual override'
    };
  }

  const normMcc = normalizeForMatching(entity.cleanName);
  const mccState = entity.stateInferred ? entity.stateInferred.toLowerCase() : null;

  const scoreCandidate = (candName, candState, candId, poolName) => {
    const normCand = normalizeForMatching(candName);
    
    // Dice on bigrams (Structural similarity)
    let dice = diceCoefficient(normMcc, normCand);
    
    // Token overlap (Semantic similarity)
    const mccTokens = normMcc.split(/\s+/).filter(t => t.length > 2);
    const candTokens = normCand.split(/\s+/).filter(t => t.length > 2);
    let overlapCount = 0;
    mccTokens.forEach(t => { if (candTokens.includes(t)) overlapCount++; });
    const tokenScore = mccTokens.length > 0 ? overlapCount / mccTokens.length : 0;
    
    // Final Base Score
    let score = (dice * 0.4) + (tokenScore * 0.6);
    
    // State Anchor Boost
    if (mccState && candState) {
        const cs = candState.toLowerCase();
        if (cs.includes(mccState) || mccState.includes(cs)) {
            score += 0.25; 
        }
    }

    // Exact name match boost
    if (normMcc === normCand) score += 0.2;

    return Math.min(score, 1.0);
  };

  // Find Best Candidate in V2 and Legacy
  const candidates = [];
  
  v2Pool.forEach(x => {
    const score = scoreCandidate(x.institution_name, x.state_name, x.institution_id, 'v2');
    if (score > 0.6) candidates.push({ id: x.institution_id, name: x.institution_name, score, source: 'v2' });
  });

  legacyPool.forEach(x => {
    const score = scoreCandidate(x.name, x.state, x.id, 'legacy');
    if (score > 0.6) candidates.push({ id: x.id, name: x.name, score, source: 'legacy' });
  });

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0) {
    const best = candidates[0];
    if (best.score > 0.88) {
      return { 
        ...result, 
        confidence: Math.round(best.score * 100), 
        target_id: best.id, 
        source: best.source,
        candidates: candidates.slice(0, 3) 
      };
    }
    result.candidates = candidates.slice(0, 5);
    result.confidence = Math.round(best.score * 100);
  }

  return result;
}

function normalizeForMatching(str) {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/[.,]/g, ' ')
        .replace(/\bmedical college\b/gi, '')
        .replace(/\band hospital\b/gi, '')
        .replace(/\badmision\b/gi, '')
        .replace(/\binst\b/gi, 'institute')
        .replace(/\bgovt\b/gi, 'government')
        .replace(/\bg\.?\s*m\.?\s*c\b/gi, 'government medical college')
        .replace(/\bm\.?\s*g\.?\s*m\b/gi, 'mgm')
        .replace(/\b[a-z]\s+([a-z])\s+([a-z])\b/gi, '$1$2') // n h -> nh
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Dice's Coefficient for fuzzy string matching
 */
function diceCoefficient(s1, s2) {
  const getBigrams = (str) => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);

  let intersect = 0;
  for (const b of b1) {
    if (b2.has(b)) intersect++;
  }

  return (2 * intersect) / (b1.size + b2.size);
}

async function writeResults(dir, report) {
  const matchesPath = path.join(dir, 'mcc_identity_bridge.ndjson');
  const ambiguousPath = path.join(dir, 'mcc_identity_ambiguous.ndjson');
  const missingPath = path.join(dir, 'mcc_identity_missing.ndjson');
  const summaryPath = path.join(dir, 'mcc_bridge_report.json');

  await fs.writeFile(matchesPath, report.matches.map(x => JSON.stringify(x)).join('\n') + '\n');
  await fs.writeFile(ambiguousPath, report.ambiguous_list.map(x => JSON.stringify(x)).join('\n') + '\n');
  await fs.writeFile(missingPath, report.missing.map(x => JSON.stringify(x)).join('\n') + '\n');
  
  const finalSummary = {
    generated_at: new Date().toISOString(),
    stats: {
      total: report.total_mcc_entities,
      manual_overrides: report.manual_overrides,
      matched_v2: report.matched_v2,
      matched_legacy: report.matched_legacy,
      ambiguous: report.ambiguous,
      unmatched: report.unmatched
    }
  };

  await fs.writeJson(summaryPath, finalSummary, { spaces: 2 });
}

main();
