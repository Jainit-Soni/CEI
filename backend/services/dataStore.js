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
      if (Array.isArray(data)) {
        combined.push(...data.filter(c => c && c.id && c.name));
      } else if (data && Array.isArray(data.institutions)) {
        combined.push(...data.institutions.filter(c => c && c.id && c.name));
      }
    } catch (err) {
      console.warn(`Failed to read ${file}:`, err.message);
    }
  }
  return combined;
}

// Initialize Redis Cache from disk
async function initializeCache() {
  const redis = await getRedisClient();
  const exists = await redis.exists(CACHE_KEYS.COLLEGES_MAP);

  if (exists) {
    console.log("Redis cache already hot");
    return;
  }

  console.log("Hydrating Redis cache from disk...");

  // Load Colleges
  const colleges = loadStateCollegeFiles();
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

  await redis.set(CACHE_KEYS.LAST_UPDATE, Date.now());
  console.log(`Cache hydrated: ${colleges.length} colleges, ${exams.length} exams`);
}

// Get all colleges
async function getColleges() {
  const redis = await getRedisClient();
  const rawMap = await redis.hgetall(CACHE_KEYS.COLLEGES_MAP);

  if (!rawMap || Object.keys(rawMap).length === 0) {
    await initializeCache();
    // Retry once
    const retryMap = await redis.hgetall(CACHE_KEYS.COLLEGES_MAP);
    return Object.values(retryMap).map(s => JSON.parse(s));
  }

  return Object.values(rawMap).map(s => JSON.parse(s));
}

// Get single college by ID
async function getCollegeById(id) {
  const redis = await getRedisClient();
  const raw = await redis.hget(CACHE_KEYS.COLLEGES_MAP, id);
  if (!raw) {
    // If cache missed, maybe it expired? Try reload
    // Optimistic check: if map exists but key missing, it's truly missing
    const exists = await redis.exists(CACHE_KEYS.COLLEGES_MAP);
    if (!exists) {
      await initializeCache();
      const retry = await redis.hget(CACHE_KEYS.COLLEGES_MAP, id);
      return retry ? JSON.parse(retry) : null;
    }
    return null;
  }
  return JSON.parse(raw);
}

// Get all exams
async function getExams() {
  const redis = await getRedisClient();
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
  console.log("Cache invalidated");
  await initializeCache();
}

module.exports = {
  getColleges,
  getCollegeById,
  getExams,
  invalidateCache
};
