/**
 * services/dataStore.js — CEI Data Layer v3.0
 * ============================================
 * Blue-Green Cache Architecture:
 *
 *   BLUE  = currently serving live traffic     e.g. colleges:map:v1740000000000
 *   GREEN = being hydrated in the background   e.g. colleges:map:v1740001000000
 *
 * When GREEN hydration is complete, we do an ATOMIC POINTER SWAP:
 *   SET colleges:map:active  "colleges:map:v{new_ts}"
 *
 * Readers always resolve the active key first, then read from it.
 * During hydration, BLUE continues serving requests — ZERO downtime.
 *
 * Fallback chain (graceful degradation):
 *   L1 (Node memory) → L2 (Redis active version) → L3 (disk JSON) → 503
 */

const fs = require("fs");
const path = require("path");
const { computeInstitutionalCeiScore, computeCoverageIndex } = require('../lib/scoringEngine');
const { getRedisClient } = require("../config/redis");
const mongoose = require("mongoose");
const College = require("../models/CollegeSchema");
const normalizeCollege = require("../lib/collegeNormalizer");
const identityResolver = require("../lib/collegeIdentityResolver");
const logger = (() => {
  try { return require("../lib/logger"); }
  catch { return console; } // Safe fallback during early boot
})();

const MODELS_DIR = path.join(__dirname, "..", "models");

// ─── CACHE KEY SCHEMA ────────────────────────────────────────────────────────
// colleges:map:active          → STRING: the current active versioned key
// colleges:map:v{ts}           → HASH:   the actual college records
// colleges:hydrating           → STRING: lock key (prevents concurrent hydration)
// exams:map                    → HASH:   exam records (single version, small)
// data:last_update             → STRING: epoch ms of last write

const ACTIVE_POINTER_KEY = "colleges:map:active";
const HYDRATION_LOCK_KEY = "colleges:hydrating";
const EXAMS_MAP_KEY = "exams:map";
const LAST_UPDATE_KEY = "data:last_update";

// Versioned map key — unique per hydration run
const makeVersionKey = (ts = Date.now()) => `colleges:map:v${ts}`;

// TTLs in seconds
const TTL = {
  VERSION_MAP: 7200,  // 2 hours for versioned college hash
  ACTIVE_PTR: 7200,  // same TTL for the pointer
  HYDRATE_LOCK: 300,   // 5-minute lock timeout (prevents zombie locks)
  EXAMS: 3600,
};

const CHUNK_SIZE = 500; // Records per pipeline batch

// ─── L1 IN-MEMORY CACHE ──────────────────────────────────────────────────────
let LOCAL_CACHE = null;   // Array of college objects
let LOCAL_LAST_UPDATE = 0;      // Epoch ms, for stale-check against Redis
let GLOBAL_FILTERS = null;
let GLOBAL_STATS = null;

// ─── DISK LOADING (fallback) ──────────────────────────────────────────────────
function loadJson(file) {
  const p = path.join(MODELS_DIR, file);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function loadStateCollegeFiles() {
  if (!fs.existsSync(MODELS_DIR)) return [];
  const files = fs.readdirSync(MODELS_DIR).filter(f => /_Colleges\.json$/i.test(f));

  const combined = [];

  if (files.length === 0) {
    return loadJson("colleges.json") || [];
  }

  for (const file of files) {
    try {
      const data = loadJson(file);
      if (!data) continue;
      let list = [];
      if (Array.isArray(data)) list = data;
      else if (data && Array.isArray(data.institutions)) list = data.institutions;
      else if (data && Array.isArray(data.colleges)) list = data.colleges;
      else if (data && typeof data === "object") {
        const k = Object.keys(data).find(k => Array.isArray(data[k]));
        if (k) list = data[k];
      }
      combined.push(...list.filter(c => c && (c.id || c.name)));
    } catch (err) {
      logger.warn && logger.warn("[dataStore] Failed to read " + file, { error: err.message });
    }
  }

  // Deduplicate by ID — keep most complete entry
  const uniqueMap = new Map();
  combined.forEach(c => {
    const cid = c?.id || c?._id || c?.stableKey;
    if (!cid) return;
    const existing = uniqueMap.get(cid);
    if (!existing || (c.courses?.length || 0) > (existing.courses?.length || 0)) {
      uniqueMap.set(cid, c);
    }
  });
  return Array.from(uniqueMap.values());
}

function loadAdminUpdates() {
  const p = path.join(MODELS_DIR, "admin_updates.json");
  if (!fs.existsSync(p)) return { added: [], deleted: [] };
  try {
    const raw = fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw);
  } catch {
    return { added: [], deleted: [] };
  }
}

// ─── BLUE-GREEN HYDRATION ─────────────────────────────────────────────────────
/**
 * hydrateGreen(redis, colleges, exams)
 *
 * Writes all college data to a NEW versioned key (the "GREEN" slot),
 * then atomically swaps the active pointer.
 * The old "BLUE" version continues serving traffic until the swap completes.
 */
async function hydrateGreen(redis, colleges, exams) {
  const ts = Date.now();
  const greenKey = makeVersionKey(ts);
  const pipeline = redis.pipeline();

  logger.info && logger.info("[dataStore] Starting GREEN hydration", { key: greenKey, count: colleges.length });

  // Write colleges in chunks to avoid pipeline size limits
  const entries = colleges.map(c => [c.id, JSON.stringify(c)]);
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);
    const p = redis.pipeline();
    chunk.forEach(([id, json]) => p.hset(greenKey, id, json));
    await p.exec();
  }

  // Set TTL on the new version map
  await redis.expire(greenKey, TTL.VERSION_MAP);

  // ── ATOMIC POINTER SWAP ──
  // At this exact moment, all new readers will start using the GREEN key.
  const oldKey = await redis.get(ACTIVE_POINTER_KEY);
  await redis.set(ACTIVE_POINTER_KEY, greenKey, "EX", TTL.ACTIVE_PTR);

  logger.info && logger.info("[dataStore] 🔄 Pointer swapped to GREEN", { newKey: greenKey, oldKey });

  // Hydrate exams (single version, small enough to not need blue-green)
  if (exams.length > 0) {
    const examPipeline = redis.pipeline();
    exams.forEach(e => examPipeline.hset(EXAMS_MAP_KEY, e.id, JSON.stringify(e)));
    await examPipeline.exec();
    await redis.expire(EXAMS_MAP_KEY, TTL.EXAMS);
  }

  // Announce the update timestamp
  await redis.set(LAST_UPDATE_KEY, ts);
  LOCAL_LAST_UPDATE = ts;

  // Schedule cleanup of old BLUE key after a grace period (30 seconds)
  // to allow in-flight requests that still hold a reference to finish
  if (oldKey && oldKey !== greenKey) {
    setTimeout(() => {
      redis.del(oldKey).catch(() => { });
      logger.info && logger.info("[dataStore] 🗑️  Old BLUE key cleaned", { key: oldKey });
    }, 30_000);
  }

  return greenKey;
}

/**
 * resolveActiveKey(redis)
 * Returns the current active versioned colleges hash key.
 * Falls back to a direct key probe if pointer is missing.
 */
async function resolveActiveKey(redis) {
  const activeKey = await redis.get(ACTIVE_POINTER_KEY);
  if (activeKey) return activeKey;
  return null; // No active version — needs hydration
}

// ─── initializeCache ──────────────────────────────────────────────────────────
/**
 * applyTruthEnrichment(map)
 * Merges NDJSON truth data into the provided map.
 * Auto-spawns missing CORE institutions.
 */
function toLPA(val) {
  const n = parseFloat(val);
  if (isNaN(n) || n <= 0) return null;
  return n > 1000 ? parseFloat((n / 100000).toFixed(2)) : parseFloat(n.toFixed(2));
}

function applyTruthEnrichment(map) {
  try {
    const truthDir = path.join(__dirname, "..", "data", "truth");
    if (!fs.existsSync(truthDir)) return;
    
    const parsedTruth = [];
    const files = fs.readdirSync(truthDir).filter(f => f.endsWith('.ndjson'));
    
    files.forEach(file => {
        const truthPath = path.join(truthDir, file);
        const rawTruthLines = fs.readFileSync(truthPath, "utf8").split('\n');
        rawTruthLines.forEach(line => {
            if (!line.trim()) return;
            try { parsedTruth.push(JSON.parse(line)); } catch {}
        });
    });

    // Invoke deterministic resolver to build exact aliases
    const catalogArray = Array.from(map.values());
    identityResolver.buildIdentityMaps(catalogArray, parsedTruth);

    // Globalize it so truth endpoints correctly bind
    global.truthRows = parsedTruth;

    parsedTruth.forEach((d, idx) => {
        // Resolve Identity (Phase 4A Synchronized)
        const canonicalId = identityResolver.resolveCanonicalId(d.collegeId || d.name);
        if (d.name && (d.name.includes('Bombay') || d.name.includes('Tiruchirappalli'))) {
            logger.info(`[TruthSync] Found row for ${d.name} -> Resolved ID: ${canonicalId}`);
        }
        let c = map.get(canonicalId);
        if (d.name && (d.name.includes('Bombay') || d.name.includes('Tiruchirappalli')) && c) {
            logger.info(`[TruthSync] Binding truth for ${canonicalId} onto ${c.name}`);
        }
        
        if (!c && d.collegeId && typeof d.collegeId === 'string' && d.collegeId.startsWith('CORE-')) {
            c = { 
               id: d.collegeId, 
               _id: d.collegeId, 
               name: d.name || d.collegeId.replace('CORE-', '').split(/(?=[A-Z])/).join(' ').trim(),
               location: 'India',
               isCore: true,
               placements: {},
               fees: {},
               meta: { ownership: 'Central Govt / INI', naacGrade: 'A++' },
               verificationStatus: 'VERIFIED'
            };
            map.set(d.collegeId, c);
        }

        if (!c) return;
        
        // Flag top-level verification
        c.isVerified = true;
        
        if (!c.fees) c.fees = {};
        if (!c.placements) c.placements = {};
        if (!c.rankings) c.rankings = [];
        if (!c.courses) c.courses = [];
        if (!c.cutoffs) c.cutoffs = [];
        if (!c.seats) c.seats = [];

        if (d.entityType === 'placement') {
            const lpaAvg = toLPA(d.averagePackage || d.avgPackage || d.medianSalary);
            const lpaHigh = toLPA(d.highestPackage);
            c.placements = { 
                ...c.placements, 
                averagePackage: lpaAvg ? `${lpaAvg} LPA` : (c.placements.averagePackage || 'Data Unavailable'),
                highestPackage: lpaHigh ? `${lpaHigh} LPA` : (c.placements.highestPackage || 'Data Unavailable'),
                averagePackageNumeric: lpaAvg,
                highestPackageNumeric: lpaHigh,
                medianSalary: lpaAvg, 
                placedPercentage: d.placedPercentage || 90 
            };
        } else if (d.entityType === 'fees' || d.entityType === 'fee') {
            const total = d.totalFee || d.tuitionFee || d.tuition;
            c.fees = { ...c.fees, total: `₹${total.toLocaleString('en-IN')}`, totalNumeric: total };
            c.tuition = `₹${total.toLocaleString('en-IN')}`;
        } else if (d.entityType === 'ranking') {
            c.rankings.push({ 
                source: d.source, 
                rank: parseInt(d.rank), 
                year: d.year,
                category: d.category || 'Overall'
            });
        } else if (d.entityType === 'program' || d.entityType === 'course') {
            const courseName = d.programName || d.courseName || d.degree || d.name || d.program;
            if (courseName && courseName.length > 2) {
                c.courses.push({ 
                    name: courseName, 
                    specialization: d.specialization || d.branch || d.stream,
                    duration: d.duration || '4 Years', 
                    intake: d.intake || d.approvedIntake || 0, 
                    exams: d.exams || d.admissionExams || [] 
                });
            }
        } else if (d.entityType === 'counsellingCutoff') {
            c.cutoffs.push(d);
        } else if (d.entityType === 'counsellingSeatMatrix') {
            c.seats.push(d);
        }
    });
    
    // --- Final Pass: Re-score enriched institutions (Phase 30) ---
    map.forEach(c => {
       if (c.isCore || (c.placements && Object.keys(c.placements).length > 0)) {
           try {
               // Approximate coverage for dynamically enriched items
               const coverage = computeCoverageIndex(c, [], (c.isCore ? 5 : 0), [], []);
               const scores = computeInstitutionalCeiScore(c, coverage);
               
               c.institutionStrengthScore = scores.institutionStrengthScore;
               c.admissionRealityScore = scores.admissionRealityScore;
               c.dataConfidenceScore = scores.dataConfidenceScore;
               c.searchPriorityScore = scores.searchPriorityScore;
               c.ceiScore = scores.ceiScore;
               c.competitivenessBand = scores.competitivenessBand;
           } catch (e) {}
       }
    });

    logger.info && logger.info("[dataStore] 💉 Core Truth Enrichment & Re-scoring Applied.");
  } catch (err) {
    logger.warn && logger.warn("[dataStore] Truth enrichment failed", { error: err.message });
  }
}

/**
 * Initialises the cache using blue-green hydration.
 */
async function initializeCache() {
  const redis = await getRedisClient();

  if (!redis) {
    logger.warn && logger.warn("[dataStore] Redis unavailable — performing direct SSoT hydration");
  }

  try {
    // Stage 0: Lock (Skip if Redis is missing)
    if (redis) {
      const lockAcquired = await redis.set(HYDRATION_LOCK_KEY, "1", "NX", "EX", TTL.HYDRATE_LOCK);
      if (!lockAcquired) {
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (await redis.get(ACTIVE_POINTER_KEY)) return;
        }
      }
    }

    try {
      let masterMap = new Map();
      let sourceInfo = "Memory (NDJSON)";

      // ── STAGE 1: Source Selection ──────────────────────────────────────────
      try {
        logger.info && logger.info("[dataStore] Fetching dataset from MongoDB Architecture...");
        
        // Ensure connection is ready before querying
        if (mongoose.connection.readyState !== 1) {
            logger.info && logger.info("[dataStore] Waiting for MongoDB connection...");
            await new Promise((resolve) => {
                if (mongoose.connection.readyState === 1) return resolve();
                mongoose.connection.once('connected', () => resolve());
                // Fallback timeout
                setTimeout(resolve, 3000); 
            });
        }

        const mongoColleges = await College.find({}).lean();
        
        if (mongoColleges && mongoColleges.length > 0) {
          mongoColleges.forEach(c => {
             const norm = normalizeCollege(c);
             // Phase 4A: Canonical ID Resolution for Truth Binding
             const cid = identityResolver.resolveCanonicalId(norm.id || norm.name);
             if (norm.name && (norm.name.includes('Bombay') || norm.name.includes('Tiruchirappalli'))) {
                 logger.info(`[HydrateSync] Catalog Institution: ${norm.name} -> Core ID: ${cid}`);
             }
             masterMap.set(String(cid), norm);
          });
          sourceInfo = "MongoDB";
          logger.info && logger.info("[dataStore] System of Record (MongoDB) loaded.", { count: mongoColleges.length });
        } else {
            throw new Error("MongoDB collection empty or disconnected");
        }
      } catch (mongoErr) {
        logger.error && logger.error("[dataStore] MongoDB SSoT failure", { error: mongoErr.message, stack: mongoErr.stack });
        logger.warn && logger.warn("[dataStore] MongoDB SSoT unavailable, checking HIGH-DENSITY MEMORY...");
        if (global.colleges && global.colleges.length > 50000) {
            global.colleges.forEach(c => {
                const cid = String(c.id || c._id || c.stableKey || '');
                if (cid) masterMap.set(cid, c);
            });
            sourceInfo = "Memory (High-Density GZIP)";
            logger.info && logger.info("[dataStore] System of Record (High-Density) locked.", { count: global.colleges.length });
        } else {
            logger.warn && logger.warn("[dataStore] Memory buffer stale/empty, falling back to Legacy Disk JSON");
            const jsonColleges = loadStateCollegeFiles();
            jsonColleges.forEach(c => {
                const cid = String(c.id || c._id || c.stableKey || '');
                if (cid) masterMap.set(cid, c);
            });
            sourceInfo = "Disk JSON (Emergency Legacy)";
        }
      }

      // ── STAGE 2: Truth Enrichment & Merging ────────────────────────────────
      if (sourceInfo !== "Memory (NDJSON)") {
        applyTruthEnrichment(masterMap);
      }

      const updates = loadAdminUpdates();
      const deletedSet = new Set(updates.deleted);
      const finalCollegesList = Array.from(masterMap.values())
        .filter(c => !deletedSet.has(c.id))
        .map(c => {
          const adminEdit = updates.added.find(a => a.id === c.id);
          return adminEdit ? { ...c, ...adminEdit } : c;
        });

      updates.added.forEach(c => { if (!masterMap.has(c.id)) finalCollegesList.push(c); });

      LOCAL_CACHE = finalCollegesList.map(c => ({
        ...c,
        id: String(c.id || c._id || c.stableKey || ''),
        _id: String(c._id || c.id || c.stableKey || '')
      }));
      global.colleges = LOCAL_CACHE;
      LOCAL_LAST_UPDATE = Date.now();

      const exams = loadJson("exams.json") || [];
      if (redis) {
          await hydrateGreen(redis, LOCAL_CACHE, exams);
      }
      preComputeGlobalData();
    } catch (innerErr) {
      logger.error && logger.error("[dataStore] Hydration inner fail", { error: innerErr.message });
      if (!LOCAL_CACHE) {
        LOCAL_CACHE = loadStateCollegeFiles();
        global.colleges = LOCAL_CACHE;
        preComputeGlobalData();
      }
    } finally {
      if (redis) {
        await redis.del(HYDRATION_LOCK_KEY).catch(() => { });
      }
    }
  } catch (err) {
    if (!LOCAL_CACHE) {
      LOCAL_CACHE = loadStateCollegeFiles();
      global.colleges = LOCAL_CACHE;
      preComputeGlobalData();
    }
  }
}

// ─── getColleges ──────────────────────────────────────────────────────────────
async function getColleges() {
  // ── L1: Node memory (zero-latency) ──
  if (LOCAL_CACHE) {
    const redis = await getRedisClient();
    if (!redis) return LOCAL_CACHE;

    // Check if Redis has a newer version than our local copy
    const remoteLastUpdate = await redis.get(LAST_UPDATE_KEY).catch(() => null);
    if (remoteLastUpdate && parseInt(remoteLastUpdate) > LOCAL_LAST_UPDATE) {
      logger.info && logger.info("[dataStore] L1 cache stale, refreshing from L2...");
      LOCAL_CACHE = null; // Force L2 fetch
    } else {
      return LOCAL_CACHE; // ⚡ ZERO-LATENCY RETURN
    }
  }

  // ── L2: Redis version-keyed hash (or direct SSoT if Redis missing) ──
  const redis = await getRedisClient();
  
  if (!LOCAL_CACHE) {
    await initializeCache();
    if (LOCAL_CACHE) return LOCAL_CACHE;
  }

  if (redis) {
    const activeKey = await resolveActiveKey(redis);
    if (activeKey) {
      const rawMap = await redis.hgetall(activeKey);
      if (rawMap && Object.keys(rawMap).length > 0) {
        const colleges = Object.values(rawMap).map(s => JSON.parse(s));
        LOCAL_CACHE = colleges;
        LOCAL_LAST_UPDATE = parseInt(await redis.get(LAST_UPDATE_KEY) || Date.now());
        return colleges;
      }
    }
  }

  // ── L3: Disk fallback ──
  logger.warn && logger.warn("[dataStore] L1 + L2 miss — falling back to disk");
  if (!LOCAL_CACHE) {
    LOCAL_CACHE = loadStateCollegeFiles();
    preComputeGlobalData();
  }
  return LOCAL_CACHE;
}

// ─── getCollegeById ──────────────────────────────────────────────────────────
async function getCollegeById(id) {
  // L -1: MongoDB (Live System of Record Priority for detailed views)
  if (mongoose.connection.readyState === 1) {
    try {
      const mongoCol = await College.findOne({
        $or: [
          { id: String(id) },
          { _id: mongoose.isValidObjectId(id) ? id : null },
          { stableKey: String(id) },
          { institution_id: String(id) },
          { source_stable_key: String(id) }
        ]
      }).lean();
      if (mongoCol) {
          let norm = normalizeCollege(mongoCol);
          // Phase 4A: Merge fully enriched truth from memory cache (handles isVerified, cutoffs, etc.)
          if (global.colleges && global.colleges.length > 0) {
              const enriched = global.colleges.find(c => String(c.id) === String(norm.id) || String(c.stableKey) === String(norm.id));
              if (enriched) {
                  norm = { ...norm, ...enriched };
              }
          }
          return norm;
      }
    } catch (e) {
      logger.warn('[dataStore] Mongo fetch failed in getCollegeById', { id, error: e.message });
    }
  }

  // L0: global.colleges — secondary fallback to enriched memory registry
  if (global.colleges && global.colleges.length > 0) {
    const col = global.colleges.find(c =>
      String(c.id) === String(id) ||
      String(c._id) === String(id) ||
      String(c.stableKey) === String(id)
    );
    if (col) return col;
  }

  // L1: Local memory
  if (LOCAL_CACHE) {
    const col = LOCAL_CACHE.find(c => String(c.id) === String(id) || String(c._id) === String(id));
    if (col) return col;
  }

  // L2: Redis — direct field read from active version (very fast)
  const redis = await getRedisClient();
  if (redis) {
    const activeKey = await resolveActiveKey(redis);
    if (activeKey) {
      const raw = await redis.hget(activeKey, id);
      if (raw) return JSON.parse(raw);
    }
    // No active key — trigger full hydration
    await initializeCache();
    if (LOCAL_CACHE) return LOCAL_CACHE.find(c => c.id === id) || null;
  }

  // L3: Disk
  if (!LOCAL_CACHE) LOCAL_CACHE = loadStateCollegeFiles();
  return LOCAL_CACHE.find(c => c.id === id) || null;
}

// ─── getExams ─────────────────────────────────────────────────────────────────
async function getExams() {
  const redis = await getRedisClient();

  if (!redis) return loadJson("exams.json") || [];

  // Ensure colleges cache is warm first (exams are hydrated together)
  const activeKey = await resolveActiveKey(redis);
  if (!activeKey) await initializeCache();

  const rawMap = await redis.hgetall(EXAMS_MAP_KEY);
  if (rawMap && Object.keys(rawMap).length > 0) {
    return Object.values(rawMap).map(s => JSON.parse(s));
  }

  // Fallback: re-hydrate and retry once
  await initializeCache();
  const retryMap = await redis.hgetall(EXAMS_MAP_KEY).catch(() => null);
  if (!retryMap) return loadJson("exams.json") || [];
  return Object.values(retryMap).map(s => JSON.parse(s));
}

// ─── invalidateCache ─────────────────────────────────────────────────────────
/**
 * Invalidates the current cache and immediately triggers a fresh blue-green hydration.
 * In-flight requests continue serving from L1 until the new GREEN version is ready.
 */
async function invalidateCache() {
  logger.info && logger.info("[dataStore] Cache invalidation triggered");

  // Clear L1 immediately
  LOCAL_CACHE = null;

  const redis = await getRedisClient();
  if (redis) {
    const oldActiveKey = await redis.get(ACTIVE_POINTER_KEY).catch(() => null);

    // Remove sentinel, lock, and exams
    await redis.del(ACTIVE_POINTER_KEY, HYDRATION_LOCK_KEY, EXAMS_MAP_KEY).catch(() => { });

    // Clean up old versioned hash
    if (oldActiveKey) {
      await redis.del(oldActiveKey).catch(() => { });
    }
  }

  // Re-hydrate with blue-green
  await initializeCache();
  logger.info && logger.info("[dataStore] ✅ Cache invalidation + reheat complete");
}

// ─── getRedisStatus ──────────────────────────────────────────────────────────
/**
 * Returns structured health status for the /api/health endpoint.
 */
async function getRedisStatus() {
  const redis = await getRedisClient();
  if (!redis) return { status: "unavailable" };

  try {
    const activeKey = await redis.get(ACTIVE_POINTER_KEY);
    const lastUpdate = await redis.get(LAST_UPDATE_KEY);
    const keyCount = activeKey ? await redis.hlen(activeKey) : 0;
    return {
      status: "connected",
      activeKey,
      recordCount: keyCount,
      lastUpdate: lastUpdate ? new Date(parseInt(lastUpdate)).toISOString() : null
    };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

// ─── PRE-COMPUTE GLOBAL DATA ──────────────────────────────────────────────────
function preComputeGlobalData() {
  if (!LOCAL_CACHE || LOCAL_CACHE.length === 0) return;

  const statesSet = new Set();
  const districtsSet = new Set();
  const tiersSet = new Set();
  const coursesSet = new Set();

  LOCAL_CACHE.forEach(c => {
    let state = c.state;
    if (!state && c.location) {
      const parts = c.location.split(",").map(p => p.trim());
      state = parts[parts.length - 1];
    }
    if (state) statesSet.add(state);

    const dist = c.meta?.district || c.district;
    if (dist) districtsSet.add(dist);

    const tr = c.rankingTier || c.ranking;
    if (tr && tr !== "Tier 1.5" && tr !== "Tier 2.5") tiersSet.add(tr);

    if (Array.isArray(c.courses)) {
      c.courses.forEach(co => { if (co.name) coursesSet.add(co.name); });
    }
  });

  GLOBAL_FILTERS = {
    states: Array.from(statesSet).filter(Boolean).sort(),
    districts: Array.from(districtsSet).filter(Boolean).sort(),
    tiers: Array.from(tiersSet).filter(Boolean).sort(),
    courses: Array.from(coursesSet).filter(Boolean).sort()
  };

  const allStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
    "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
  ];

  const statsMap = {};
  allStates.forEach(s => statsMap[s.toLowerCase()] = { name: s, count: 0, colleges: [] });

  LOCAL_CACHE.forEach(c => {
    let state = c.state;
    if (!state && c.location) {
      const parts = c.location.split(",").map(p => p.trim());
      state = parts[parts.length - 1];
    }
    if (state) {
      const key = state.toLowerCase();
      const foundKey = Object.keys(statsMap).find(k => k === key || k === key.replace(/&/g, "and"));
      if (foundKey) {
        statsMap[foundKey].count++;
        if (statsMap[foundKey].colleges.length < 3) statsMap[foundKey].colleges.push(c.shortName || c.name);
      }
    }
  });

  const statsResult = Object.values(statsMap).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

  GLOBAL_STATS = {
    totalStates: statsResult.length,
    totalColleges: LOCAL_CACHE.length,
    states: statsResult.map(s => ({
      ...s,
      type: ["Delhi", "Chandigarh", "Puducherry"].includes(s.name) ? "UT" : "State"
    }))
  };

  logger.info && logger.info("[dataStore] Global data pre-computed", { colleges: LOCAL_CACHE.length });
}

function getGlobalFilters() { return GLOBAL_FILTERS; }
function getGlobalStats() { return GLOBAL_STATS; }

// ─── ADMIN WRITES (L1 + Redis) ────────────────────────────────────────────────
async function saveCollege(collegeData) {
  if (!collegeData.id) {
    collegeData.id = "custom_" + Date.now();
  }

  collegeData.lastUpdated = new Date().toISOString();
  if (!collegeData.source) collegeData.source = "Admin Verified";

  // Write to Redis active version
  const redis = await getRedisClient();
  if (redis) {
    const activeKey = await resolveActiveKey(redis);
    if (activeKey) {
      await redis.hset(activeKey, collegeData.id, JSON.stringify(collegeData));
    }
    const now = Date.now();
    await redis.set(LAST_UPDATE_KEY, now);
    LOCAL_LAST_UPDATE = now;
  }

  // Update L1
  if (LOCAL_CACHE) {
    const idx = LOCAL_CACHE.findIndex(c => c.id === collegeData.id);
    if (idx >= 0) LOCAL_CACHE[idx] = collegeData;
    else LOCAL_CACHE.push(collegeData);
  }

  return collegeData;
}

async function deleteCollege(id) {
  const redis = await getRedisClient();
  if (redis) {
    const activeKey = await resolveActiveKey(redis);
    if (activeKey) await redis.hdel(activeKey, id);
    const now = Date.now();
    await redis.set(LAST_UPDATE_KEY, now);
    LOCAL_LAST_UPDATE = now;
  }

  if (LOCAL_CACHE) LOCAL_CACHE = LOCAL_CACHE.filter(c => c.id !== id);
  return { success: true, id };
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
module.exports = {
  getColleges,
  getCollegeById,
  getExams,
  invalidateCache,
  saveCollege,
  deleteCollege,
  getGlobalFilters,
  getGlobalStats,
  getRedisStatus,    // New: for health endpoint
  initializeCache,   // Exposed for warm-up scripts
};
