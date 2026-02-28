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
const { getRedisClient } = require("../config/redis");
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
    if (!c?.id) return;
    const existing = uniqueMap.get(c.id);
    if (!existing || (c.courses?.length || 0) > (existing.courses?.length || 0)) {
      uniqueMap.set(c.id, c);
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
 * Initialises the cache using blue-green hydration.
 * Uses a distributed lock (Redis SETNX) to prevent concurrent hydration
 * under simultaneous cold-start requests (thundering herd).
 */
async function initializeCache() {
  const redis = await getRedisClient();

  if (!redis) {
    logger.warn && logger.warn("[dataStore] Redis unavailable — loading to L1 memory only");
    if (!LOCAL_CACHE) {
      LOCAL_CACHE = loadStateCollegeFiles();
      LOCAL_LAST_UPDATE = Date.now();
      preComputeGlobalData();
    }
    return;
  }

  // ── Distributed lock — prevent thundering herd ──
  const lockAcquired = await redis.set(HYDRATION_LOCK_KEY, "1", "NX", "EX", TTL.HYDRATE_LOCK);
  if (!lockAcquired) {
    logger.info && logger.info("[dataStore] Hydration already in progress (lock held). Waiting for active key...");
    // Poll until the active pointer appears (another instance is hydrating)
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      const activeKey = await redis.get(ACTIVE_POINTER_KEY);
      if (activeKey) {
        logger.info && logger.info("[dataStore] Active key appeared. Proceeding.");
        return;
      }
    }
    logger.warn && logger.warn("[dataStore] Timed out waiting for hydration. Falling back to disk.");
    if (!LOCAL_CACHE) {
      LOCAL_CACHE = loadStateCollegeFiles();
      preComputeGlobalData();
    }
    return;
  }

  try {
    logger.info && logger.info("[dataStore] Acquired hydration lock. Loading from disk...");

    // Load + deduplicate from state JSON files
    const colleges = loadStateCollegeFiles();

    // Apply admin overrides (additions/deletions)
    const updates = loadAdminUpdates();
    const deletedSet = new Set(updates.deleted);

    let finalColleges = colleges.filter(c => !deletedSet.has(c.id));
    const adminMap = new Map(updates.added.map(c => [c.id, c]));

    // Merge admin additions / edits
    finalColleges = finalColleges.map(c => adminMap.has(c.id) ? { ...c, ...adminMap.get(c.id) } : c);
    updates.added.forEach(c => {
      if (!finalColleges.find(f => f.id === c.id)) finalColleges.push(c);
    });

    // Set L1 immediately so requests don't wait for Redis pipeline
    LOCAL_CACHE = finalColleges;
    LOCAL_LAST_UPDATE = Date.now();

    // Load exams
    const exams = loadJson("exams.json") || [];

    // Perform blue-green hydration (write to GREEN, swap pointer)
    const activeKey = await hydrateGreen(redis, finalColleges, exams);

    logger.info && logger.info("[dataStore] ✅ Cache hydration complete", {
      colleges: finalColleges.length,
      exams: exams.length,
      activeKey
    });

    preComputeGlobalData();
  } finally {
    // Always release the lock
    await redis.del(HYDRATION_LOCK_KEY);
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

  // ── L2: Redis version-keyed hash ──
  const redis = await getRedisClient();
  if (redis) {
    const activeKey = await resolveActiveKey(redis);

    if (!activeKey) {
      // No active version → trigger hydration
      await initializeCache();
      if (LOCAL_CACHE) return LOCAL_CACHE;
    } else {
      const rawMap = await redis.hgetall(activeKey);
      if (rawMap && Object.keys(rawMap).length > 0) {
        const colleges = Object.values(rawMap).map(s => JSON.parse(s));
        LOCAL_CACHE = colleges;
        LOCAL_LAST_UPDATE = parseInt(await redis.get(LAST_UPDATE_KEY) || Date.now());
        return colleges;
      }
      // Active key exists but hash is empty → stale pointer, re-hydrate
      await initializeCache();
      if (LOCAL_CACHE) return LOCAL_CACHE;
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
  // L1: Local memory
  if (LOCAL_CACHE) {
    const col = LOCAL_CACHE.find(c => c.id === id);
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
