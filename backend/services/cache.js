const { getRedisClient } = require("../config/redis");

module.exports = {
  async get(key) {
    try {
      const redis = await getRedisClient();
      if (!redis) return null;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error("Cache GET error:", err);
      return null;
    }
  },
  async set(key, value, ttl = 300) {
    try {
      const redis = await getRedisClient();
      if (!redis) return false;
      await redis.set(key, JSON.stringify(value), "EX", ttl);
      return true;
    } catch (err) {
      console.error("Cache SET error:", err);
      return false;
    }
  },
  async del(key) {
    try {
      const redis = await getRedisClient();
      if (!redis) return false;
      await redis.del(key);
      return true;
    } catch (err) {
      console.error("Cache DEL error:", err);
      return false;
    }
  },
  async delPattern(pattern) {
    try {
      const redis = await getRedisClient();
      if (!redis) return false;
      // Use SCAN to avoid blocking Redis with KEYS on large datasets
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
      return false;
    }
  }
};
