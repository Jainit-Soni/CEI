const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const { getRedisClient } = require('./config/redis');

async function flushCache() {
    console.log("Connecting to Redis...");
    const redis = await getRedisClient();
    if (redis) {
        console.log("Connected. Flushing 'colleges:map'...");
        await redis.del('colleges:map');
        await redis.del('colleges_initialized');
        console.log("Redis cache cleared successfully.");
    } else {
        console.log("No Redis client available.");
    }
    process.exit(0);
}

flushCache().catch(console.error);
