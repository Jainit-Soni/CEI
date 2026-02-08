const { invalidateCache, getColleges } = require("./services/dataStore");
const { getRedisClient } = require("./config/redis");

async function run() {
    console.log("Connecting to Redis...");
    const redis = await getRedisClient();

    console.log("Flushing ALL keys (clearing route cache + data cache)...");
    try {
        await redis.flushdb(); // Clear everything in the current database
        console.log("Redis FLUSHDB executed.");
    } catch (e) {
        console.error("Flush failed, trying keys...", e);
    }

    console.log("Re-initializing data...");
    const colleges = await getColleges(); // This will trigger initializeCache()
    console.log(`Loaded ${colleges.length} colleges.`);

    await redis.quit();
}

run().catch(console.error);
