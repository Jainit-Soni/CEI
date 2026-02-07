const { getRedisClient } = require("../config/redis");

module.exports = {
  async get(key) {
    try {
      const redis = await getRedisClient();
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
      await redis.set(key, JSON.stringify(value), "EX", ttl);
      return true;
    } catch (err) {
      console.error("Cache SET error:", err);
      return false;
    }
  }
};
