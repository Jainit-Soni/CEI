const crypto = require("crypto");
const { getRedisClient } = require("../config/redis");

async function generateKey(tier = "free") {
    const key = "cei_" + crypto.randomBytes(16).toString("hex");
    const redis = await getRedisClient();

    const data = JSON.stringify({
        tier,
        active: true,
        created: Date.now()
    });

    await redis.hset("api_keys", key, data);
    console.log(`Generated ${tier} key: ${key}`);
    return key;
}

// Allow running from command line
if (require.main === module) {
    const args = process.argv.slice(2);
    const tier = args[0] || "free";
    generateKey(tier).then(() => process.exit(0)).catch(console.error);
}

module.exports = generateKey;
