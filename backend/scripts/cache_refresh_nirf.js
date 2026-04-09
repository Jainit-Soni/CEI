require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const { getRedisClient } = require('../config/redis');
const dataStore = require('../services/dataStore');
const pageCache = require('../services/collegePageCache');
const fs = require('fs');
const path = require('path');

async function run() {
    const redis = await getRedisClient();
    const reportPath = path.join(__dirname, '../reports/nirf_2024/cache_refresh_report.json');
    const refreshResults = {
        timestamp: new Date().toISOString(),
        invalidatedKeys: [],
        operations: []
    };

    console.log("⚡ Starting Deterministic Cache Refresh...");

    try {
        // 1. Invalidate L1/L2 Memory Cache (DataStore)
        await dataStore.invalidateCache();
        refreshResults.operations.push("dataStore.invalidateCache");
        console.log("✅ L1/L2 DataStore Cache Invalidated.");

        // 2. Invalidate College Page Cache
        if (redis) {
            const keys = await redis.keys('college:page:*');
            if (keys.length > 0) {
                await redis.del(...keys);
                refreshResults.invalidatedKeys.push(...keys);
                refreshResults.operations.push(`redis.del(${keys.length} keys)`);
                console.log(`✅ Flushed ${keys.length} College Page cache entries.`);
            }
        } else {
            console.warn("⚠️ Redis unavailable, skipping Page Cache flush.");
        }

        fs.writeFileSync(reportPath, JSON.stringify(refreshResults, null, 2));
        console.log(`✅ Cache Refresh Complete! Report saved to ${reportPath}`);
        
    } catch (err) {
        console.error("❌ Cache refresh failed:", err);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

run();
