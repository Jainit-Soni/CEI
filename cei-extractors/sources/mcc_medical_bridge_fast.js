#!/usr/bin/env node

/**
 * MCC Medical Identity Bridge (Fast v1)
 * Optimized matching using state-based pre-filtering.
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
    
    const v2ByState = groupByState(v2Institutions, 'state_name');
    const legacyByState = groupByState(legacyColleges, 'state');

    console.log(`Loaded ${v2Institutions.length} v2 candidates and ${legacyColleges.length} legacy candidates.`);

    console.log('Loading manual overrides...');
    const overrideMap = await loadManualOverrides(OUT_DIR);

    console.log('\n--- Phase 2: Source Extraction ---');
    const mccSourceData = await extractUniqueMccEntities(INPUT_PATH);
    console.log(`Found ${mccSourceData.length} unique MCC entities in source.`);

    console.log('\n--- Phase 3: Resolution Core (Optimized) ---');
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

    let done = 0;
    for (const entity of mccSourceData) {
      const match = resolveEntityOptimized(entity, v2ByState, legacyByState, overrideMap);
      
      if (match.source === 'manual_override') {
        report.manual_overrides++;
        report.matches.push(match);
      } else if (match.confidence >= 85) {
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
      done++;
      if (done % 50 === 0) console.log(`  Processed ${done}/${mccSourceData.length}...`);
    }

    console.log('\n--- Phase 4: Output Generation ---');
    await writeResults(OUT_DIR, report);

    console.log('\n--- Audit Summary ---');
    console.log(`Total Mapped: ${report.matched_v2 + report.matched_legacy + report.manual_overrides}`);
    console.log(`Results written to: ${OUT_DIR}`);

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

function groupByState(pool, stateKey) {
    const map = new Map();
    for (const item of pool) {
        const s = String(item[stateKey] || 'UNKNOWN').toLowerCase().trim();
        if (!map.has(s)) map.set(s, []);
        map.get(s).push(item);
    }
    return map;
}

function resolveEntityOptimized(entity, v2ByState, legacyByState, overrideMap) {
  const result = {
    mcc_id: entity.mccId,
    mcc_name_raw: entity.rawName,
    clean_name: entity.cleanName,
    confidence: 0,
    target_id: null,
    source: null,
    candidates: []
  };

  const override = (entity.mccId && overrideMap.get('ID:' + entity.mccId)) || overrideMap.get('RAW:' + entity.rawName);
  if (override) {
    return { ...result, confidence: 100, target_id: override.resolved_target_id, source: 'manual_override' };
  }

  const normMcc = normalizeForMatching(entity.cleanName);
  const mccState = entity.stateInferred ? entity.stateInferred.toLowerCase().trim() : null;

  const scoreCandidate = (candName, candState) => {
    const normCand = normalizeForMatching(candName);
    const dice = diceCoefficient(normMcc, normCand);
    const mccTokens = normMcc.split(/\s+/).filter(t => t.length > 2);
    const candTokens = normCand.split(/\s+/).filter(t => t.length > 2);
    let overlapCount = 0;
    mccTokens.forEach(t => { if (candTokens.includes(t)) overlapCount++; });
    const tokenScore = mccTokens.length > 0 ? overlapCount / mccTokens.length : 0;
    let score = (dice * 0.4) + (tokenScore * 0.6);
    if (mccState && candState && (candState.toLowerCase().includes(mccState) || mccState.includes(candState.toLowerCase()))) {
        score += 0.25; 
    }
    if (normMcc === normCand) score += 0.2;
    return Math.min(score, 1.0);
  };

  const candidates = [];
  
  // Search in inferred state + generic categories
  const statesToSearch = new Set([mccState, 'unknown', 'delhi', 'all india']);
  for (const s of statesToSearch) {
    if (!s) continue;
    (v2ByState.get(s) || []).forEach(x => {
        const score = scoreCandidate(x.institution_name, x.state_name);
        if (score > 0.6) candidates.push({ id: x.institution_id, name: x.institution_name, score, source: 'v2' });
    });
    (legacyByState.get(s) || []).forEach(x => {
        const score = scoreCandidate(x.name, x.state);
        if (score > 0.6) candidates.push({ id: x.id, name: x.name, score, source: 'legacy' });
    });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    result.confidence = Math.round(best.score * 100);
    result.target_id = best.id;
    result.target_name = best.name;
    result.source = best.source;
    result.candidates = candidates.slice(0, 5);
  }

  return result;
}

async function extractUniqueMccEntities(filePath) {
  const entities = new Map();
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  for (const line of lines) {
    const doc = JSON.parse(line);
    const raw = doc.institution_name_raw;
    if (!raw || entities.has(raw)) continue;
    entities.set(raw, {
        mccId: doc.mcc_id,
        rawName: raw,
        cleanName: doc.institution_name_clean,
        stateInferred: doc.institution_state_raw
    });
  }
  return Array.from(entities.values());
}

function normalizeForMatching(str) {
  return String(str || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function diceCoefficient(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);
  let intersect = 0;
  for (const bi of bigramsA) {
    if (bigramsB.has(bi)) intersect++;
  }
  return (2 * intersect) / (bigramsA.size + bigramsB.size);
}

function getBigrams(str) {
  const bigrams = new Set();
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.slice(i, i + 2));
  }
  return bigrams;
}

async function writeResults(dir, report) {
    const bridgePath = path.join(dir, 'mcc_identity_bridge.ndjson');
    const missingPath = path.join(dir, 'mcc_identity_missing.ndjson');
    const ambigPath = path.join(dir, 'mcc_identity_ambiguous.ndjson');

    await fs.writeFile(bridgePath, report.matches.map(m => JSON.stringify(m)).join('\n') + '\n');
    await fs.writeFile(missingPath, report.missing.map(m => JSON.stringify(m)).join('\n') + '\n');
    await fs.writeFile(ambigPath, report.ambiguous_list.map(m => JSON.stringify(m)).join('\n') + '\n');
}

async function loadManualOverrides(dir) { return new Map(); }

main().catch(console.error);
