#!/usr/bin/env node

/**
 * MCC UG cutoff bridge direct mapper (v5, Multi-Source: v2 + legacy)
 */

const fs = require('fs-extra');
const path = require('path');
const { MongoClient } = require('mongodb');

const INPUT_PATH = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_results/mcc_ug_closing_ranks_v2.ndjson';
const OUTPUT_PATH = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_results/mcc_ug_cutoffs_mapped_v2.ndjson';
const MONGO_URI = 'mongodb://localhost:27017';

const ACRONYMS = {
    'aiims': 'all india institute of medical sciences',
    'gmc': 'government medical college',
    'rims': 'regional institute of medical sciences',
    'mamc': 'maulana azad medical college',
    'vmmc': 'vardhman mahavir medical college',
    'jipmer': 'jawaharlal institute of postgraduate medical education and research',
    'bhu': 'banaras hindu university',
    'amu': 'aligarh muslim university',
    'lhmc': 'lady hardinge medical college',
    'ucms': 'university college of medical sciences',
    'kgmc': 'king georges medical university',
    'mgm': 'mahatma gandhi memorial'
};

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const dbV2 = client.db('cei_v2');
  const dbLegacy = client.db('cei_legacy');
  
  console.log('Loading candidates from MongoDB...');
  const v2Pool = await dbV2.collection('institutions').find({}, { projection: { institution_name: 1, institution_id: 1 } }).toArray();
  const legacyPool = await dbLegacy.collection('colleges').find({}, { projection: { name: 1, id: 1 } }).toArray();
  
  const pool = [
      ...v2Pool.map(x => ({ id: x.institution_id, name: x.institution_name, source: 'v2' })),
      ...legacyPool.map(x => ({ id: x.id, name: x.name, source: 'legacy' }))
  ];

  console.log('Pre-calculating bigrams...');
  const preparedPool = pool.map(inst => {
    const norm = normalizeForMatching(inst.name);
    return {
        ...inst,
        norm: norm,
        bigrams: getBigrams(norm)
    };
  });
  console.log(`Prepared ${preparedPool.length} candidates.`);

  const cutoffLines = (await fs.readFile(INPUT_PATH, 'utf8')).split('\n').filter(Boolean);
  const out = [];

  let mappedCount = 0;
  const cache = new Map();

  for (const line of cutoffLines) {
    const cutoff = JSON.parse(line);
    const rawName = cutoff.institute_raw;
    if (!rawName) continue;

    const cleanName = normalizeName(rawName);
    
    let bestMatch;
    if (cache.has(cleanName)) {
        bestMatch = cache.get(cleanName);
    } else {
        bestMatch = findBestMatch(cleanName, preparedPool);
        cache.set(cleanName, bestMatch);
    }

    if (bestMatch && bestMatch.score > 0.70) {
        out.push({
            ...cutoff,
            institution_id: bestMatch.id,
            institution_name_canonical: bestMatch.name,
            match_score: Math.round(bestMatch.score * 100),
            is_resolved: true,
            source: bestMatch.source
        });
        mappedCount++;
    } else {
        out.push({
            ...cutoff,
            institution_id: null,
            is_resolved: false,
            best_candidate: bestMatch ? bestMatch.name : null,
            candidate_score: bestMatch ? Math.round(bestMatch.score * 100) : 0
        });
    }
  }

  await fs.writeFile(OUTPUT_PATH, out.map(o => JSON.stringify(o)).join('\n') + '\n', 'utf8');
  console.log(`Mapped ${mappedCount} / ${cutoffLines.length} cutoffs.`);
  await client.close();
}

function findBestMatch(name, pool) {
    let best = null;
    let maxScore = 0;
    const normName = normalizeForMatching(name);
    const bigramsName = getBigrams(normName);
    if (bigramsName.size === 0) return null;

    for (const inst of pool) {
        let score = diceCoefficient(bigramsName, inst.bigrams);
        if (normName.includes(inst.norm) || inst.norm.includes(normName)) score += 0.15;
        if (score > maxScore) {
            maxScore = score;
            best = { ...inst, score };
        }
        if (score > 1.0) break;
    }
    return best;
}

function diceCoefficient(bigramsA, bigramsB) {
  let intersect = 0;
  for (const bi of bigramsA) { if (bigramsB.has(bi)) intersect++; }
  return (2 * intersect) / (bigramsA.size + bigramsB.size);
}

function getBigrams(str) {
  const bigrams = new Set();
  for (let i = 0; i < str.length - 1; i++) { bigrams.add(str.slice(i, i + 2)); }
  return bigrams;
}

function normalizeForMatching(str) {
  let s = String(str || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [short, long] of Object.entries(ACRONYMS)) {
    const rx = new RegExp(`\\b${short}\\b`, 'g');
    s = s.replace(rx, long);
  }
  return s;
}

function normalizeName(name) {
    return String(name || '')
      .replace(/\s+/g, ' ')
      .replace(/,.*$/, '')
      .replace(/\d{6}/g, '')
      .replace(/\(.*\)/g, '')
      .trim();
}

main().catch(console.error);
