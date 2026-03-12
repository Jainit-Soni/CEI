const { getRedisClient } = require("../config/redis");

// Lightweight In-Memory Fallback Cache
const localCache = new Map();
const LOCAL_TTL_MS = 60000; // 1 minute default for local fallback

module.exports = {
  async get(key) {
    // 1. Try In-Memory first (fastest)
    if (localCache.has(key)) {
      const { value, expiry } = localCache.get(key);
      if (Date.now() < expiry) {
        return value;
      }
      localCache.delete(key);
    }

    try {
      const redis = await getRedisClient();
      if (!redis) return null;
      const data = await redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        localCache.set(key, { value: parsed, expiry: Date.now() + LOCAL_TTL_MS });
        return parsed;
      }
      return null;
    } catch (err) {
      if (!err.message.includes("max requests limit exceeded")) {
        console.error("Cache GET error:", err.message);
      }
      return null;
    }
  },

  async set(key, value, ttl = 300) {
    // 1. Set In-Memory
    localCache.set(key, { value, expiry: Date.now() + Math.min(ttl * 1000, LOCAL_TTL_MS) });

    try {
      const redis = await getRedisClient();
      if (!redis) return true;
      await redis.set(key, JSON.stringify(value), "EX", ttl);
      return true;
    } catch (err) {
      if (!err.message.includes("max requests limit exceeded")) {
        console.error("Cache SET error:", err.message);
      }
      return true;
    }
  },

  async del(key) {
    localCache.delete(key);
    try {
      const redis = await getRedisClient();
      if (!redis) return true;
      await redis.del(key);
      return true;
    } catch (err) {
      console.error("Cache DEL error:", err);
      return true;
    }
  },

  async delPattern(pattern) {
    // Clear relevant local cache entries
    const regexPattern = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    for (const key of localCache.keys()) {
      if (regexPattern.test(key)) {
        localCache.delete(key);
      }
    }

    try {
      const redis = await getRedisClient();
      if (!redis) return true;
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
      return true;
    } catch (err) {
      console.error("Cache DEL PATTERN error:", err);
      return true;
    }
  }
};
