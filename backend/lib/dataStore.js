const fs = require('fs');
const path = require('path');
const readline = require('readline');
const zlib = require('zlib');
const logger = require('./logger');
const identityResolver = require('./identityResolver');
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
  const gzPath = path.join(__dirname, '..', 'data', 'colleges.ndjson.gz');
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
    
    let unresolvedCount = 0;
    
    for (const tr of global.truthRows) {
      // 1. Resolve Canonical Identity
      const nameResolvedId = tr.name ? identityResolver.resolveId(tr.name) : null;
      const idResolvedId = (tr.collegeId || tr.stableKey || tr.id) ? identityResolver.resolveId(tr.collegeId || tr.stableKey || tr.id) : null;
      
      const canonicalId = nameResolvedId || idResolvedId;

      // 2. Index by Canonical ID (Structured per Surface)
      if (canonicalId) {
        if (!global.truthByCid.has(canonicalId)) {
          global.truthByCid.set(canonicalId, {
            courses: [],
            cutoffs: [],
            seats: [],
            fees: [],
            placements: [],
            verified: [],
            compliance: [],
            benchmarks: []
          });
        }
        
        const index = global.truthByCid.get(canonicalId);
        const record = {
            ...tr,
            _canonicalId: canonicalId,
            _matchBasis: nameResolvedId ? 'name_registry' : 'id_registry',
            _rawIdentity: tr.name || tr.collegeId || tr.stableKey || tr.id,
            _sourceFamily: tr.sourceFamily || 'legacy',
            _surface: tr.entityType
        };

        // Partition by entityType
        const type = tr.entityType;
        if (type === 'placement') index.placements.push(record);
        else if (type === 'fees' || type === 'fee') index.fees.push(record);
        else if (type === 'ranking') index.compliance.push(record); // Map ranking to compliance
        else if (type === 'counsellingCutoff') index.cutoffs.push(record);
        else if (type === 'counsellingSeatMatrix') index.seats.push(record);
        else if (type === 'program' || type === 'course') index.courses.push(record);
        else if (type === 'state_benchmark') index.benchmarks.push(record);
        else {
            // Default to compliance for unknown types if they look like truth
            index.compliance.push(record);
        }
      } else {
        unresolvedCount++;
        if (unresolvedCount < 10) {
            logger.warn(`[DataStore] Unresolved truth row: ${tr.name || tr.collegeId || 'Unknown'}`);
        }
      }

      // 3. Legacy Name indexing (still used by some parts of the system)
      if (tr.name) {
        const key = tr.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!global.truthByName.has(key)) global.truthByName.set(key, []);
        global.truthByName.get(key).push(tr);
      }

      // 4. AISHE-style ID tracking
      const cid = tr.collegeId || tr.stableKey || tr.id;
      if (cid && cid.match(/^[CSU]-[0-9]+$/)) {
        if (!global.truthByAishe.has(cid)) global.truthByAishe.set(cid, []);
        global.truthByAishe.get(cid).push(tr);
      }
    }
    logger.info(`[DataStore] Canonicalized truth rows: ${global.truthRows.length - unresolvedCount} resolved, ${unresolvedCount} unresolved.`);
  }

  // 2.5 Load Verified Fields and Source Evidence
  if (fs.existsSync(verifiedPath)) {
    global.verifiedFields = [];
    const rl = readline.createInterface({ input: fs.createReadStream(verifiedPath), crlfDelay: Infinity });
    for await (const line of rl) {
      if (line.trim()) {
        try { global.verifiedFields.push(JSON.parse(line)); } catch (e) { }
      }
    }
    logger.info(`[DataStore] Loaded ${global.verifiedFields.length} verified fields.`);
  }

  if (fs.existsSync(evidencePath)) {
    global.sourceEvidence = [];
    const rl = readline.createInterface({ input: fs.createReadStream(evidencePath), crlfDelay: Infinity });
    for await (const line of rl) {
      if (line.trim()) {
        try { global.sourceEvidence.push(JSON.parse(line)); } catch (e) { }
      }
    }
    logger.info(`[DataStore] Loaded ${global.sourceEvidence.length} evidence records.`);
  }

  // 3. Helper for Truth Enrichment
  // Converts raw INR to LPA (anything > 1000 is assumed INR, divide by 100000)
  const toLPA = (val) => {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) return null;
    return n > 1000 ? parseFloat((n / 100000).toFixed(2)) : parseFloat(n.toFixed(2));
  };

  const applyRow = (obj, d) => {
    // Flag the institution as verified if any valid truth row is applied
    obj.isVerified = true;

    // ── Placements ──────────────────────────────────────────────────────────
    if (d.entityType === 'placement') {
        const rawAvg = d.averagePackage || d.avgPackage || d.medianSalary || d.medianPackage;
        const lpaAvg = toLPA(rawAvg);
        if (lpaAvg && lpaAvg > 0) {
            const rawHigh = d.highestPackage;
            const lpaHigh = rawHigh ? toLPA(rawHigh) : null;
            obj.placements = {
                ...obj.placements,
                averagePackage: `${lpaAvg} LPA`,
                averagePackageNumeric: lpaAvg,
                highestPackage: lpaHigh ? `${lpaHigh} LPA` : obj.placements?.highestPackage,
                highestPackageNumeric: lpaHigh || obj.placements?.highestPackageNumeric,
                placedPercentage: d.placedPercentage || obj.placements?.placedPercentage || 90,
                academicYear: d.academicYear || '2023-24',
                source: d.source || 'Institutional Report',
                isVerified: true
            };
        }
    // ── Fees ────────────────────────────────────────────────────────────────
    } else if (d.entityType === 'fees' || d.entityType === 'fee' || d.entityType === 'fee_structure') {
        const feeNum = parseFloat(d.totalFee || d.tuition || d.total || 0);
        if (feeNum > 0) {
            obj.fees = {
                ...obj.fees,
                total: `₹${feeNum.toLocaleString('en-IN')} INR`,
                totalNumeric: feeNum,
                tuition: d.tuition ? `₹${d.tuition.toLocaleString('en-IN')} INR` : obj.fees?.tuition,
                hostelFees: d.hostelFees ? `₹${d.hostelFees.toLocaleString('en-IN')} INR` : obj.fees?.hostelFees,
                hostelNumeric: d.hostelFees || obj.fees?.hostelNumeric,
                source: d.source || 'Official Fee Structure',
                session: d.session || '2024-25',
                isVerified: true
            };
        }
    // ── Rankings ────────────────────────────────────────────────────────────
    } else if (d.entityType === 'ranking') {
        if (!obj.rankings) obj.rankings = [];
        const rankNum = parseInt(d.rank);
        obj.rankings.push({ source: d.source, rank: rankNum, year: d.year, category: d.category });
        // Promote NIRF for tiering
        if ((d.source === 'NIRF' || d.source === 'NIRF 2024') && rankNum > 0) {
            obj.ranking = rankNum;
            obj.rankingTier = rankNum <= 50 ? 'Tier 1' : rankNum <= 200 ? 'Tier 2' : 'Tier 3';
            obj.nirfRank = rankNum;
        }
    // ── Metadata (established, accreditation, website, contact, courses) ────
    } else if (d.entityType === 'metadata') {
        if (d.established)     obj.established = d.established;
        if (d.website)         obj.website = obj.website || d.website;
        if (d.phone)           obj.phone = d.phone;
        if (d.email)           obj.email = d.email;
        if (d.affiliatedTo)    obj.affiliatedTo = d.affiliatedTo;
        if (d.accreditation)   obj.accreditation = { ...obj.accreditation, ...d.accreditation };
        if (d.coordinates)     obj.coordinates = d.coordinates;
        if (d.totalSeats)      obj.totalSeats = d.totalSeats;
        if (d.admissionExams)  obj.admissionExams = d.admissionExams;
        if (d.naacGrade)       obj.accreditation = { ...obj.accreditation, naac: d.naacGrade, naacScore: d.naacScore };
        if (d.courses && d.courses.length > 0) {
            if (!obj.courses) obj.courses = [];
            obj.courses = [...obj.courses, ...d.courses];
        }
    // ── Courses/Programs ─────────────────────────────────────────────────────
    } else if (d.entityType === 'course' || d.entityType === 'program') {
        if (!obj.courses) obj.courses = [];
        const courseName = d.programName || d.courseName || d.degree || d.name || d.program;
        if (courseName && courseName.length > 2) {
            obj.courses.push({ 
                name: courseName, 
                specialization: d.specialization || d.branch || d.stream,
                duration: d.duration || '4 Years', 
                intake: d.intake || d.approvedIntake || 0, 
                exams: d.exams || d.admissionExams || [] 
            });
        }
    }
  };

  // 4. Main Ingestion
  const matchedCoreNames = new Set();
  const activePath = fs.existsSync(gzPath) ? gzPath : (fs.existsSync(dataPath) ? dataPath : null);

  if (activePath) {
    global.colleges = [];
    const isGzip = activePath.endsWith('.gz');
    let inputStream = fs.createReadStream(activePath);
    if (isGzip) {
        inputStream = inputStream.pipe(zlib.createGunzip());
    }

    const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line || line.length < 5) continue; 
      try {
        const obj = JSON.parse(line);
        if (!obj.name) continue;

        const normName = obj.name.toLowerCase().trim();
        const rawCid = obj.id || obj._id || obj.stableKey;
        const cid = identityResolver.resolveId(rawCid);

        // Core Linkage
        if (global.coreInstitutes.has(normName)) {
            obj.isCore = true;
            obj.coreMetadata = global.coreInstitutes.get(normName);
            matchedCoreNames.add(normName);
        }

        // Apply Truth Enrichment
        if (cid && global.truthByCid.has(cid)) {
            const index = global.truthByCid.get(cid);
            Object.values(index).flat().forEach(tr => applyRow(obj, tr));
        }
        if (normName && global.truthByName.has(normName)) global.truthByName.get(normName).forEach(tr => applyRow(obj, tr));
        
        // Final Score Finalization
        const coverage = computeCoverageIndex(obj, [], 0, [], []);
        const scores = computeInstitutionalCeiScore(obj, coverage);
        Object.assign(obj, scores);
        
        global.colleges.push(obj);
      } catch (e) { }
    }
  }

  // 4.5 Load Registry Mapping for ID Unification
  const registryPath = path.join(__dirname, '..', 'data', 'truth', 'core_id_mapping_batch1.json');
  const registryRemap = {};
  if (fs.existsSync(registryPath)) {
      try {
          const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
          Object.entries(registry.engineering_map).forEach(([name, id]) => {
              const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
              registryRemap[key] = id;
          });
          // Add AIIMS Delhi
          registryRemap['allindiainstituteofmedicalsciencesdelhi'] = 'CORE-AIIMS-DELHI';
      } catch (e) { }
  }

  // 5. Virtualization Pass
  for (const [key, coreMetadata] of global.coreInstitutes.entries()) {
    if (!matchedCoreNames.has(key)) {
      try {
        const productCid = identityResolver.resolveId(coreMetadata.canonicalName) || `CORE-${key.toUpperCase()}`;
        const virtualObj = {
          id: productCid,
          name: coreMetadata.canonicalName,
          location: `${coreMetadata.city || 'Unknown'}, ${coreMetadata.state}`,
          isCore: true,
          coreMetadata: coreMetadata,
          rankingTier: coreMetadata.coreTier === 1 ? 'Tier 1' : 'Tier 2',
          placements: {}, rankings: [], fees: {}
        };
        
        // Virtual Truth Linkage
        if (global.truthByName.has(key)) global.truthByName.get(key).forEach(tr => applyRow(virtualObj, tr));
        
        // Link structured truth by resolved CID
        if (global.truthByCid.has(productCid)) {
            const index = global.truthByCid.get(productCid);
            Object.values(index).flat().forEach(tr => applyRow(virtualObj, tr));
        }

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
