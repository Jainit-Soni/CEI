const { getColleges } = require('./backend/services/dataStore');
const { getRedisClient } = require('./backend/config/redis');

async function benchmark() {
    const redis = await getRedisClient();
    await redis.del("colleges:initialized"); // Force re-init

    console.log("--- Benchmark Start ---");

    // 1. Cold Start (will trigger hydration)
    console.time("1. Cold Request (Redis/Disk -> Parse)");
    const data1 = await getColleges();
    console.timeEnd("1. Cold Request (Redis/Disk -> Parse)");
    console.log(`Loaded ${data1.length} colleges.`);

    // 2. Warm Request (Should be instant from L1 Cache)
    console.time("2. Warm Request (L1 Cache)");
    const data2 = await getColleges();
    console.timeEnd("2. Warm Request (L1 Cache)");

    // 3. Warm Request Again
    console.time("3. Warm Request Again (L1 Cache)");
    const data3 = await getColleges();
    console.timeEnd("3. Warm Request Again (L1 Cache)");

    process.exit(0);
}

benchmark().catch(console.error);
