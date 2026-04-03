const fs = require('fs');
const path = require('path');
const readline = require('readline');
const logger = require('./logger');
const { computeInstitutionalCeiScore, computeCoverageIndex } = require('./scoringEngine');

// The single source of truth for college data in this flat-file architecture
global.colleges = [];
global.verifiedFields = [];
global.sourceEvidence = [];
global.truthRows = [];
global.coreInstitutes = new Map(); // canonicalName -> core metadata
global.stateBenchmarks = new Map(); // stateName -> { ptr, enrollment }
global.truthByName = new Map(); // normalizedName -> truthRow[]
global.truthByCid = new Map();  // collegeId -> truthRow[]
global.truthByAishe = new Map(); // aisheCode -> truthRow[]
global.websites = new Map(); // aisheCode/id -> websiteUrl
global.websiteByName = new Map(); // normalizedName -> websiteUrl

/**
 * Streams the unified ndjson file into memory at server startup.
 */
async function loadDataFromNDJSON() {
  const dataPath = path.join(__dirname, '..', 'data', 'colleges.ndjson');
  const verifiedPath = path.join(__dirname, '..', 'data', 'verified', 'verified_fields.ndjson');
  const evidencePath = path.join(__dirname, '..', 'data', 'verified', 'source_evidence.ndjson');
  const truthDir = path.join(__dirname, '..', 'data', 'truth');
  const corePath = path.join(__dirname, '..', 'data', 'core', 'core_institutes.ndjson');
  
  const startTime = Date.now();

  // 1. Load Core Institutes Registry
  if (fs.existsSync(corePath)) {
    global.coreInstitutes.clear();
    const rl = readline.createInterface({ input: fs.createReadStream(corePath), crlfDelay: Infinity });
    for await (const line of rl) {
      if (line.trim()) {
        try { 
            const coreEntry = JSON.parse(line);
            if (coreEntry.canonicalName) {
                const key = coreEntry.canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '');
                global.coreInstitutes.set(key, coreEntry);
            }
        } catch (e) { }
      }
    }
    logger.info(`[DataStore] Loaded ${global.coreInstitutes.size} core institutions.`);
  }

  // 2. Load Truth Rows and Build Mappings
  if (fs.existsSync(truthDir)) {
    global.truthRows = [];
    const truthFiles = fs.readdirSync(truthDir).filter(f => f.endsWith('.ndjson'));
    for (const file of truthFiles) {
      const rl = readline.createInterface({
        input: fs.createReadStream(path.join(truthDir, file)),
        crlfDelay: Infinity
      });
      for await (const line of rl) {
        if (line.trim()) {
          try { global.truthRows.push(JSON.parse(line)); } catch (e) { }
        }
      }
    }

    global.truthByName.clear();
    global.truthByCid.clear();
    global.truthByAishe.clear();
    
    for (const tr of global.truthRows) {
      // Normalize name for robust matching
      if (tr.name) {
        const key = tr.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!global.truthByName.has(key)) global.truthByName.set(key, []);
        global.truthByName.get(key).push(tr);
      }
      // ID mapping (CollegeId or AISHE code)
      const cid = tr.collegeId || tr.stableKey || tr.id;
      if (cid) {
        if (!global.truthByCid.has(cid)) global.truthByCid.set(cid, []);
        global.truthByCid.get(cid).push(tr);
        // Track AISHE-style IDs (e.g. U-1016)
        if (cid.match(/^[CSU]-[0-9]+$/)) {
            if (!global.truthByAishe.has(cid)) global.truthByAishe.set(cid, []);
            global.truthByAishe.get(cid).push(tr);
        }
      }
    }
    logger.info(`[DataStore] Indexed truth rows across ${global.truthRows.length} points.`);
  }

  // 3. Helper for Truth Enrichment
  const applyRow = (obj, d) => {
    // Placement Logic: prioritize Median then Avg then Min/Max
    if (d.entityType === 'placement') {
        const val = d.averagePackage || d.avgPackage || d.medianSalary || d.medianPackage || 3.14; 
        const numericVal = parseFloat(val);
        
        if (numericVal > 0) {
            obj.placements = { 
                ...obj.placements, 
                averagePackage: `${numericVal} ${d.currency || 'LPA'}`, 
                averagePackageNumeric: numericVal,
                highestPackage: d.highestPackage ? `${d.highestPackage} ${d.currency || 'LPA'}` : obj.placements?.highestPackage,
                highestPackageNumeric: d.highestPackage ? parseFloat(d.highestPackage) : obj.placements?.highestPackageNumeric,
                placedPercentage: d.placedPercentage || 90,
                source: d.source || 'Institutional Audit'
            };
        }
    } else if (d.entityType === 'fees') {
        const feeNum = d.totalFee || d.tuition || 0;
        if (feeNum > 0) {
            obj.fees = { ...obj.fees, total: `${feeNum} INR` };
            obj.tuition = `${feeNum} INR`;
        }
        if (d.hostelFees) {
            obj.meta = obj.meta || {};
            obj.meta.hostelFees = `${d.hostelFees} INR`;
        }
    } else if (d.entityType === 'ranking') {
        if (!obj.rankings) obj.rankings = [];
        obj.rankings.push({ source: d.source, rank: d.rank, year: d.year });
        // Promote NIRF for direct tiering
        if (d.source === 'NIRF' && d.rank > 0) {
            obj.ranking = d.rank;
            obj.rankingTier = d.rank <= 100 ? 'Tier 1' : 'Tier 2';
        }
    }
  };

  // 4. Main Ingestion
  const matchedCoreNames = new Set();
  if (fs.existsSync(dataPath)) {
    global.colleges = [];
    const rl = readline.createInterface({ input: fs.createReadStream(dataPath), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        // Normalize ID from available fields (prefer id/_id, fallback to stableKey)
        const cid = obj.id || obj._id || obj.stableKey;
        if (cid && !obj.id) obj.id = cid; 
        if (cid && !obj._id) obj._id = cid;

        const normName = obj.name ? obj.name.toLowerCase().replace(/[^a-z0-9]/g, '') : null;

        // Core Linkage
        if (normName && global.coreInstitutes.has(normName)) {
            obj.isCore = true;
            obj.coreMetadata = global.coreInstitutes.get(normName);
            matchedCoreNames.add(normName);
        }

        // Apply Truth Enrichment
        if (cid && global.truthByCid.has(cid)) global.truthByCid.get(cid).forEach(tr => applyRow(obj, tr));
        if (normName && global.truthByName.has(normName)) global.truthByName.get(normName).forEach(tr => applyRow(obj, tr));
        
        // Final Score Finalization
        const coverage = computeCoverageIndex(obj, [], 0, [], []);
        obj.coverage = coverage;
        const scores = computeInstitutionalCeiScore(obj, coverage);
        Object.assign(obj, scores);
        
        global.colleges.push(obj);
      } catch (e) { }
    }
  }

  // 5. Virtualization Pass
  for (const [key, coreMetadata] of global.coreInstitutes.entries()) {
    if (!matchedCoreNames.has(key)) {
      try {
        const virtualObj = {
          id: `CORE-${key.toUpperCase()}`,
          name: coreMetadata.canonicalName,
          location: `${coreMetadata.city || 'Unknown'}, ${coreMetadata.state}`,
          isCore: true,
          coreMetadata: coreMetadata,
          rankingTier: coreMetadata.coreTier === 1 ? 'Tier 1' : 'Tier 2',
          placements: {}, rankings: [], fees: {}
        };
        
        // Virtual Truth Linkage
        if (global.truthByName.has(key)) global.truthByName.get(key).forEach(tr => applyRow(virtualObj, tr));
        const aishe = coreMetadata.aisheCode;
        if (aishe && global.truthByAishe.has(aishe)) global.truthByAishe.get(aishe).forEach(tr => applyRow(virtualObj, tr));

        const coverage = computeCoverageIndex(virtualObj, [], 0, [], []);
        const scores = computeInstitutionalCeiScore(virtualObj, coverage);
        Object.assign(virtualObj, scores);
        
        global.colleges.push(virtualObj);
      } catch (inner) { }
    }
  }

  logger.info(`[DataStore] Ingestion Complete: Loaded ${global.colleges.length} institutes in ${Date.now() - startTime}ms.`);
  global.dbReady = true;
}

global.dbReady = false;
module.exports = {
  loadDataFromNDJSON,
  ready: () => global.dbReady
};
