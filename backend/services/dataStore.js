const fs = require("fs");
const path = require("path");
const { getRedisClient } = require("../config/redis");

const MODELS_DIR = path.join(__dirname, "..", "models");

// Cache keys
const CACHE_KEYS = {
  COLLEGES_MAP: "colleges:map",
  EXAMS_MAP: "exams:map",
  LAST_UPDATE: "data:last_update"
};

// TTL in seconds
const TTL = {
  COLLEGES: 3600, // 1 hour
  EXAMS: 3600     // 1 hour
};

function loadJson(file) {
  const p = path.join(MODELS_DIR, file);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  const cleaned = raw.replace(/^\uFEFF/, "");
  return JSON.parse(cleaned);
}

function loadStateCollegeFiles() {
  if (!fs.existsSync(MODELS_DIR)) return [];
  const files = fs.readdirSync(MODELS_DIR).filter((file) => /_Colleges\.json$/i.test(file));

  const combined = [];

  if (files.length === 0) {
    const legacyData = loadJson("colleges.json");
    return legacyData || [];
  }

  for (const file of files) {
    try {
      const data = loadJson(file);
      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.institutions)) {
        list = data.institutions;
      } else if (data && Array.isArray(data.colleges)) {
        list = data.colleges;
      } else if (data && typeof data === 'object') {
        // Fallback for objects that might have one key containing the list
        const possibleKey = Object.keys(data).find(k => Array.isArray(data[k]));
        if (possibleKey) list = data[possibleKey];
      }

      const validColleges = list.filter(c => c && (c.id || c.name));
      combined.push(...validColleges);
      // console.log(`Loaded ${validColleges.length} from ${file}`);
    } catch (err) {
      console.warn(`Failed to read ${file}:`, err.message);
    }
  }
  // Deduplicate by ID to ensure accuracy
  const uniqueMap = new Map();
  combined.forEach(c => {
    if (c && c.id) {
      // Only keep the most complete one if IDs clash
      if (!uniqueMap.has(c.id) || (c.courses?.length > (uniqueMap.get(c.id).courses?.length || 0))) {
        uniqueMap.set(c.id, c);
      }
    }
  });

  return Array.from(uniqueMap.values());
}

// --- L1 IN-MEMORY CACHE ---
let LOCAL_CACHE = null;
let LOCAL_LAST_UPDATE = 0;

// Initialize Redis Cache from disk
async function initializeCache() {
  const redis = await getRedisClient();
  // Check for the sentinel key to see if initialization is complete
  const initialized = await redis.exists(CACHE_KEYS.COLLEGES_INITIALIZED);

  if (initialized) {
    console.log("Redis cache already hot");
    return;
  }

  console.log("Hydrating Redis cache from disk...");

  // Load Colleges
  const colleges = loadStateCollegeFiles();

  // Update Local Cache immediately
  LOCAL_CACHE = colleges;
  LOCAL_LAST_UPDATE = Date.now();

  if (colleges.length > 0) {
    const collegeMap = {};
    colleges.forEach(c => {
      collegeMap[c.id] = JSON.stringify(c);
    });

    // Store in chunks to avoid stack overflow/too large command
    const entries = Object.entries(collegeMap);
    const CHUNK_SIZE = 1000;

    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = Object.fromEntries(entries.slice(i, i + CHUNK_SIZE));
      await redis.hmset(CACHE_KEYS.COLLEGES_MAP, chunk);
    }
    await redis.expire(CACHE_KEYS.COLLEGES_MAP, TTL.COLLEGES);
  }

  // Apply Admin Updates (Additions/Edits/Deletions)
  const updates = loadAdminUpdates();

  // 1. Apply Deletions
  if (updates.deleted.length > 0) {
    await redis.hdel(CACHE_KEYS.COLLEGES_MAP, ...updates.deleted);
    // Update local cache
    LOCAL_CACHE = LOCAL_CACHE.filter(c => !updates.deleted.includes(c.id));
  }

  // 2. Apply Additions/Edits
  if (updates.added.length > 0) {
    const updateMap = {};
    updates.added.forEach(c => {
      updateMap[c.id] = JSON.stringify(c);

      // Update local cache
      const idx = LOCAL_CACHE.findIndex(lc => lc.id === c.id);
      if (idx >= 0) {
        LOCAL_CACHE[idx] = c;
      } else {
        LOCAL_CACHE.push(c);
      }
    });

    // Deduplicate LOCAL_CACHE one last time for safety
    const finalMap = new Map();
    LOCAL_CACHE.forEach(c => finalMap.set(c.id, c));
    LOCAL_CACHE = Array.from(finalMap.values());

    await redis.hmset(CACHE_KEYS.COLLEGES_MAP, updateMap);
  }

  // Load Exams
  const exams = loadJson("exams.json") || [];
  if (exams.length > 0) {
    const examMap = {};
    exams.forEach(e => {
      examMap[e.id] = JSON.stringify(e);
    });
    await redis.hmset(CACHE_KEYS.EXAMS_MAP, examMap);
    await redis.expire(CACHE_KEYS.EXAMS_MAP, TTL.EXAMS);
  }

  await redis.set(CACHE_KEYS.LAST_UPDATE, LOCAL_LAST_UPDATE);
  // Set the sentinel key to indicate successful initialization
  await redis.set(CACHE_KEYS.COLLEGES_INITIALIZED, "true", "EX", TTL.COLLEGES); // Use TTL for consistency

  // --- PRE-COMPUTE HEAVY DATA (PERFORMANCE BOOST) ---
  console.log("Pre-computing filters and stats...");
  preComputeGlobalData();
  // console.log(`Cache hydrated: ${colleges.length} colleges, ${exams.length} exams`);
}

// Global In-Memory Data (Zero Latency)
let GLOBAL_FILTERS = null;
let GLOBAL_STATS = null;

function preComputeGlobalData() {
  if (!LOCAL_CACHE || LOCAL_CACHE.length === 0) return;

  // 1. FILTERS
  const statesSet = new Set();
  const districtsSet = new Set();
  const tiersSet = new Set();
  const coursesSet = new Set();

  LOCAL_CACHE.forEach(c => {
    // State
    let state = c.state;
    if (!state && c.location) {
      const parts = c.location.split(",").map(p => p.trim());
      state = parts[parts.length - 1];
    }
    if (state) statesSet.add(state);

    // District
    const dist = c.meta?.district || c.district;
    if (dist) districtsSet.add(dist);

    // Tier
    const tr = c.rankingTier || c.ranking;
    if (tr) tiersSet.add(tr);

    // Courses
    if (Array.isArray(c.courses)) {
      c.courses.forEach(co => {
        if (co.name) coursesSet.add(co.name);
      });
    }
  });

  GLOBAL_FILTERS = {
    states: Array.from(statesSet).filter(Boolean).sort(),
    districts: Array.from(districtsSet).filter(Boolean).sort(),
    tiers: Array.from(tiersSet).filter(Boolean).sort(),
    courses: Array.from(coursesSet).filter(Boolean).sort()
  };

  // 2. STATS (State-wise)
  const statsMap = {};
  const allStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
    "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
  ];

  allStates.forEach(s => statsMap[s.toLowerCase()] = { name: s, count: 0, colleges: [] });

  LOCAL_CACHE.forEach(c => {
    let state = c.state;
    if (!state && c.location) {
      const parts = c.location.split(",").map(p => p.trim());
      state = parts[parts.length - 1];
    }
    if (state) {
      const key = state.toLowerCase();
      // Try matching normalized
      const foundKey = Object.keys(statsMap).find(k => k === key || k === key.replace(/&/g, 'and'));
      if (foundKey) {
        statsMap[foundKey].count++;
        if (statsMap[foundKey].colleges.length < 3) {
          statsMap[foundKey].colleges.push(c.shortName || c.name);
        }
      }
    }
  });

  const statsResult = Object.values(statsMap)
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count);

  GLOBAL_STATS = {
    totalStates: statsResult.length, // Simplified
    totalColleges: LOCAL_CACHE.length,
    states: statsResult.map(s => ({
      ...s,
      type: ["Delhi", "Chandigarh", "Puducherry"].includes(s.name) ? "UT" : "State"
    }))
  };

  console.log("Global data pre-computed.");
}

function getGlobalFilters() { return GLOBAL_FILTERS; }
function getGlobalStats() { return GLOBAL_STATS; }

// Get all colleges
async function getColleges() {
  const redis = await getRedisClient();

  // 1. FAST PATH: Check Local In-Memory Cache
  if (LOCAL_CACHE) {
    // Optional: Check staleness occasionally (e.g. every 5 seconds) or rely on Redis events
    // For now, let's minimally check Redis LAST_UPDATE to ensure sync across potential instances
    const remoteLastUpdate = await redis.get(CACHE_KEYS.LAST_UPDATE);
    if (remoteLastUpdate && parseInt(remoteLastUpdate) > LOCAL_LAST_UPDATE) {
      console.log("Local cache stale, refreshing...");
      LOCAL_CACHE = null; // Force refresh
    } else {
      return LOCAL_CACHE; // ZERO-LATENCY RETURN
    }
  }

  // Check for the sentinel key
  const initialized = await redis.exists(CACHE_KEYS.COLLEGES_INITIALIZED);

  if (!initialized) {
    await initializeCache();
    // initializeCache populates LOCAL_CACHE
    if (LOCAL_CACHE) return LOCAL_CACHE;
  }

  // If we reach here, either LOCAL_CACHE was null and initialized, or we need to fetch from Redis
  // console.time("RedisFetch");
  const rawMap = await redis.hgetall(CACHE_KEYS.COLLEGES_MAP);
  // console.timeEnd("RedisFetch");

  if (!rawMap) return [];

  // console.time("JsonParse");
  const colleges = Object.values(rawMap).map(s => JSON.parse(s));
  // console.timeEnd("JsonParse");

  // Populate Local Cache for next time
  LOCAL_CACHE = colleges;
  const lastUpdate = await redis.get(CACHE_KEYS.LAST_UPDATE);
  LOCAL_LAST_UPDATE = lastUpdate ? parseInt(lastUpdate) : Date.now();

  return colleges;
}

// Get single college by ID
async function getCollegeById(id) {
  // Try Local Cache First
  if (LOCAL_CACHE) {
    const col = LOCAL_CACHE.find(c => c.id === id);
    if (col) return col;
  }

  const redis = await getRedisClient();
  // Check for the sentinel key
  const initialized = await redis.exists(CACHE_KEYS.COLLEGES_INITIALIZED);

  if (!initialized) {
    await initializeCache();
    // Try local again after init
    if (LOCAL_CACHE) {
      return LOCAL_CACHE.find(c => c.id === id) || null;
    }
  }

  const raw = await redis.hget(CACHE_KEYS.COLLEGES_MAP, id);
  return raw ? JSON.parse(raw) : null;
}

// Get all exams
async function getExams() {
  const redis = await getRedisClient();
  // Check for the sentinel key
  const initialized = await redis.exists(CACHE_KEYS.COLLEGES_INITIALIZED);

  if (!initialized) {
    await initializeCache();
  }

  const rawMap = await redis.hgetall(CACHE_KEYS.EXAMS_MAP);

  if (!rawMap || Object.keys(rawMap).length === 0) {
    await initializeCache();
    const retryMap = await redis.hgetall(CACHE_KEYS.EXAMS_MAP);
    return Object.values(retryMap).map(s => JSON.parse(s));
  }

  return Object.values(rawMap).map(s => JSON.parse(s));
}

// Invalidate cache
async function invalidateCache() {
  const redis = await getRedisClient();
  await redis.del(CACHE_KEYS.COLLEGES_MAP, CACHE_KEYS.EXAMS_MAP);
  LOCAL_CACHE = null; // Clear local cache
  console.log("Cache invalidated");
  await initializeCache();
}

const ADMIN_UPDATES_FILE = "admin_updates.json";

function loadAdminUpdates() {
  const p = path.join(MODELS_DIR, ADMIN_UPDATES_FILE);
  if (!fs.existsSync(p)) return { added: [], deleted: [] };
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Failed to read admin updates:", err);
    return { added: [], deleted: [] };
  }
}

function saveAdminUpdates(data) {
  const p = path.join(MODELS_DIR, ADMIN_UPDATES_FILE);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// Create or Update a college
async function saveCollege(collegeData) {
  const updates = loadAdminUpdates();

  if (!collegeData.id) {
    // Generate simple ID if missing
    collegeData.id = "custom_" + Date.now();
  }

  // Remove from deleted list if it was there (undelete)
  updates.deleted = updates.deleted.filter(id => id !== collegeData.id);

  // Ensure Trust Fields
  collegeData.lastUpdated = new Date().toISOString();
  if (!collegeData.source) {
    collegeData.source = "Admin Verified"; // Default source for admin edits
  }

  // Update or Add to "added" list
  const existingIndex = updates.added.findIndex(c => c.id === collegeData.id);
  if (existingIndex >= 0) {
    updates.added[existingIndex] = { ...updates.added[existingIndex], ...collegeData };
  } else {
    updates.added.push(collegeData);
  }

  saveAdminUpdates(updates);

  // Update Redis
  const redis = await getRedisClient();
  await redis.hset(CACHE_KEYS.COLLEGES_MAP, collegeData.id, JSON.stringify(collegeData));

  // Update Timestamp
  const now = Date.now();
  await redis.set(CACHE_KEYS.LAST_UPDATE, now);
  LOCAL_LAST_UPDATE = now;

  // Update Local Cache
  if (LOCAL_CACHE) {
    const idx = LOCAL_CACHE.findIndex(c => c.id === collegeData.id);
    if (idx >= 0) {
      LOCAL_CACHE[idx] = collegeData;
    } else {
      LOCAL_CACHE.push(collegeData);
    }
  }

  return collegeData;
}

// Delete a college
async function deleteCollege(id) {
  const updates = loadAdminUpdates();

  // Remove from "added" list if present
  updates.added = updates.added.filter(c => c.id !== id);

  // Add to "deleted" list if not already there
  if (!updates.deleted.includes(id)) {
    updates.deleted.push(id);
  }

  saveAdminUpdates(updates);

  // Update Redis
  const redis = await getRedisClient();
  await redis.hdel(CACHE_KEYS.COLLEGES_MAP, id);

  // Update Timestamp
  const now = Date.now();
  await redis.set(CACHE_KEYS.LAST_UPDATE, now);
  LOCAL_LAST_UPDATE = now;

  // Update Local Cache
  if (LOCAL_CACHE) {
    LOCAL_CACHE = LOCAL_CACHE.filter(c => c.id !== id);
  }

  return { success: true, id };
}

module.exports = {
  getColleges,
  getCollegeById,
  getExams,
  invalidateCache,
  saveCollege,
  deleteCollege,
  getGlobalFilters,
  getGlobalStats
};
