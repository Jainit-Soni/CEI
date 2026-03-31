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
global.websites = new Map(); // aisheCode/id -> websiteUrl
global.websiteByName = new Map(); // normalizedName -> websiteUrl

/**
 * Streams the unified ndjson file into memory at server startup.
 * Using a ReadStream prevents memory spikes that would occur with JSON.parse on a massive file.
 */
async function loadDataFromNDJSON() {
  const dataPath = path.join(__dirname, '..', 'data', 'colleges.ndjson');
  const verifiedPath = path.join(__dirname, '..', 'data', 'verified', 'verified_fields.ndjson');
  const evidencePath = path.join(__dirname, '..', 'data', 'verified', 'source_evidence.ndjson');
  const truthDir = path.join(__dirname, '..', 'data', 'truth');
  const corePath = path.join(__dirname, '..', 'data', 'core', 'core_institutes.ndjson');
  
  const startTime = Date.now();

  // Load Core Institutes Registry
  if (fs.existsSync(corePath)) {
    global.coreInstitutes.clear();
    const rl = readline.createInterface({ input: fs.createReadStream(corePath), crlfDelay: Infinity });
    for await (const line of rl) {
      if (line.trim()) {
        try { 
            const coreEntry = JSON.parse(line);
            if (coreEntry.canonicalName) {
                // Normalize for robust matching
                const key = coreEntry.canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '');
                global.coreInstitutes.set(key, coreEntry);
            }
        } catch (e) { }
      }
    }
    logger.info(`[DataStore] Loaded ${global.coreInstitutes.size} core institutions.`);
  }

  // Load Verified Fields
  if (fs.existsSync(verifiedPath)) {
    global.verifiedFields = [];
    const rl = readline.createInterface({ input: fs.createReadStream(verifiedPath), crlfDelay: Infinity });
    for await (const line of rl) {
      if (line.trim()) {
        try { global.verifiedFields.push(JSON.parse(line)); } catch (e) { }
      }
    }
  }

  // Load Source Evidence
  if (fs.existsSync(evidencePath)) {
    global.sourceEvidence = [];
    const rl = readline.createInterface({ input: fs.createReadStream(evidencePath), crlfDelay: Infinity });
    for await (const line of rl) {
      if (line.trim()) {
        try { global.sourceEvidence.push(JSON.parse(line)); } catch (e) { }
      }
    }
  }

  // Load all Truth NDJSON files from data/truth/
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
    logger.info(`[DataStore] Loaded ${global.truthRows.length} truth rows from ${truthFiles.length} file(s).`);

    global.truthByName.clear();
    for (const tr of global.truthRows) {
      if (tr.name) {
        const key = tr.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!global.truthByName.has(key)) global.truthByName.set(key, []);
        global.truthByName.get(key).push(tr);
      }
    }
    logger.info(`[DataStore] Indexed ${global.truthByName.size} truth institutions by name.`);
  }

  // --- Build Coverage Lookup Maps (one pass each, before college ingestion) ---
  // Map: collegeId -> string[] of verified fieldNames
  const verifiedFieldMap = new Map();
  for (const vf of global.verifiedFields) {
    if (!vf.collegeId) continue;
    if (!verifiedFieldMap.has(vf.collegeId)) verifiedFieldMap.set(vf.collegeId, []);
    verifiedFieldMap.get(vf.collegeId).push(vf.fieldName);
  }

  // Map: collegeId -> { count, entityTypes: Set, sourceFamilies: Set }
  const truthMap = new Map();
  for (const tr of global.truthRows) {
    // Truth rows may reference college by collegeId or stableKey alias
    const cid = tr.collegeId || tr.stableKey;
    if (!cid) continue;
    if (!truthMap.has(cid)) truthMap.set(cid, { count: 0, entityTypes: new Set(), sourceFamilies: new Set() });
    const entry = truthMap.get(cid);
    entry.count++;
    if (tr.entityType) entry.entityTypes.add(tr.entityType);
    if (Array.isArray(tr.sourceFamilies)) tr.sourceFamilies.forEach(sf => entry.sourceFamilies.add(sf));
    else if (tr.sourceFamily) entry.sourceFamilies.add(tr.sourceFamily);
  }

  // Map: stateName -> benchmarkData
  global.stateBenchmarks.clear();
  for (const tr of global.truthRows) {
    if (tr.entityType === 'state_benchmark' && tr.state) {
      global.stateBenchmarks.set(tr.state.toLowerCase(), tr);
    }
  }
  logger.info(`[DataStore] Cached ${global.stateBenchmarks.size} state-level benchmarks.`);

  // Map: id/stableKey -> website
  global.websites.clear();
  global.websiteByName.clear();
  for (const tr of global.truthRows) {
    if (tr.website) {
      const targetId = tr.stableKey || tr.id;
      if (targetId) global.websites.set(targetId, tr.website);
      if (tr.name) {
          const key = tr.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          global.websiteByName.set(key, tr.website);
      }
    }
  }
  logger.info(`[DataStore] Cached ${global.websites.size} websites by ID/Key, ${global.websiteByName.size} by name.`);

  // Load Colleges (main ingestion loop)
  const matchedCoreKeys = new Set();
  if (fs.existsSync(dataPath)) {
    console.log(`[DataStore] Beginning streamed ingestion of NDJSON from ${dataPath}...`);
    global.colleges = [];
    const fileStream = fs.createReadStream(dataPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.stableKey && !obj.id) obj.id = obj.stableKey;
        if (obj.id && !obj._id) obj._id = obj.id;
        
        // --- Core Institution Check ---
        if (obj.name) {
            const key = obj.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (global.coreInstitutes.has(key)) {
                obj.isCore = true;
                obj.coreMetadata = global.coreInstitutes.get(key);
                matchedCoreKeys.add(key);
            }
        }

        // --- Verified Website Linkage ---
        const cid = obj.id || obj._id;
        const skey = obj.stableKey;
        if (skey && global.websites.has(skey)) {
            obj.website = global.websites.get(skey);
        } else if (cid && global.websites.has(cid)) {
            obj.website = global.websites.get(cid);
        } else if (obj.name) {
            const key = obj.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (global.websiteByName.has(key)) {
                obj.website = global.websiteByName.get(key);
            }
        }

        // 1. Coverage Index (COMPUTE FIRST in Phase 13)
        let coverage = {};
        try {
            const id = obj.id || obj._id;
            const coreKey = obj.isCore ? `CORE-${obj.name.toLowerCase().replace(/[^a-z0-9]/g, '').toUpperCase()}` : null;
            
            const vfNames = verifiedFieldMap.get(id) || [];
            const truthEntry = truthMap.get(id) || (coreKey ? truthMap.get(coreKey) : null) || { count: 0, entityTypes: new Set(), sourceFamilies: new Set() };
            
            coverage = computeCoverageIndex(
                obj,
                vfNames,
                truthEntry.count,
                Array.from(truthEntry.entityTypes),
                Array.from(truthEntry.sourceFamilies)
            );
            obj.coverage = coverage;
        } catch (covErr) {
            process.stdout.write(`[DataStore][Error] Coverage ${obj.name}: ${covErr.message}\n`);
        }

        // 2. Multi-Dimensional CEI Scores
        try {
            const scores = computeInstitutionalCeiScore(obj, coverage);
            obj.institutionStrengthScore = scores.institutionStrengthScore;
            obj.admissionRealityScore = scores.admissionRealityScore;
            obj.dataConfidenceScore = scores.dataConfidenceScore;
            obj.searchPriorityScore = scores.searchPriorityScore;
            obj.ceiScore = scores.ceiScore; // Legacy / Primary view
            obj.competitivenessBand = scores.competitivenessBand;
            
            if (global.colleges.length < 5) {
                process.stdout.write(`[DataStore][Debug] Scored ${obj.name}: STR=${obj.institutionStrengthScore}, CONF=${obj.dataConfidenceScore}\n`);
            }
        } catch (scoreErr) {
            process.stdout.write(`[DataStore][Error] CEI ${obj.name}: ${scoreErr.message}\n`);
        }
        
        global.colleges.push(obj);
      } catch (e) { }
    }
  }

  // --- Virtual Ingestion: Append unmatched Core institutions ---
  for (const [key, coreMetadata] of global.coreInstitutes.entries()) {
    if (!matchedCoreKeys.has(key)) {
      try {
        const virtualObj = {
          id: `CORE-${key.toUpperCase()}`,
          _id: `CORE-${key.toUpperCase()}`,
          name: coreMetadata.canonicalName,
          location: `${coreMetadata.city || 'Unknown'}, ${coreMetadata.state}`,
          type: coreMetadata.institutionType || 'Core Institution',
          isCore: true,
          verificationStatus: 'VERIFIED',
          rankingTier: coreMetadata.coreTier === 1 ? 'Tier 1' : 'Tier 2',
          sourceFamily: 'Core Registry',
          coreMetadata: coreMetadata,
          courses: [],
          placements: {},
          fees: {}
        };
        
        // Coverage (Compute first)
        const vid = `CORE-${key.toUpperCase()}`;
        const truthEntry = truthMap.get(vid) || { count: 0, entityTypes: new Set(), sourceFamilies: new Set() };
        
        const coverage = computeCoverageIndex(
            virtualObj, 
            [], 
            truthEntry.count, 
            Array.from(truthEntry.entityTypes), 
            Array.from(truthEntry.sourceFamilies)
        );
        virtualObj.coverage = coverage;

        const scores = computeInstitutionalCeiScore(virtualObj, coverage);
        virtualObj.institutionStrengthScore = scores.institutionStrengthScore;
        virtualObj.admissionRealityScore = scores.admissionRealityScore;
        virtualObj.dataConfidenceScore = scores.dataConfidenceScore;
        virtualObj.searchPriorityScore = scores.searchPriorityScore;
        virtualObj.ceiScore = scores.ceiScore;
        virtualObj.competitivenessBand = scores.competitivenessBand;
        
        global.colleges.push(virtualObj);
        // logger.debug(`[DataStore] Virtualized unmatched core: ${virtualObj.name}`);
      } catch (virtualErr) {
        logger.error(`[DataStore] Error virtualizing ${coreMetadata.canonicalName}: ${virtualErr.message}`);
      }
    }
  }

  const duration = Date.now() - startTime;
  logger.info(`[DataStore] Ingestion Complete: Loaded ${global.colleges.length} colleges, ${global.verifiedFields.length} verified fields, ${global.truthRows.length} truth rows in ${duration}ms.`);
  global.dbReady = true;
}

// Expose loading function and state
global.dbReady = false;

module.exports = {
  loadDataFromNDJSON,
  get ready() { return global.dbReady; }
};

