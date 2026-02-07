const Redis = require("ioredis");

let redisClient = null;

function createRedisClient() {
    if (redisClient) {
        return redisClient;
    }

    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    redisClient = new Redis(redisUrl, {
        retryStrategy(times) {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
    });

    redisClient.on("connect", () => {
        console.log("✅ Redis connected");
    });

    redisClient.on("error", (err) => {
        console.error("❌ Redis error:", err.message);
    });

    redisClient.on("close", () => {
        console.log("⚠️  Redis connection closed");
    });

    return redisClient;
}

async function getRedisClient() {
    if (!redisClient) {
        redisClient = createRedisClient();
    }

    // Ensure connection is established
    if (redisClient.status !== "ready") {
        await redisClient.connect();
    }

    return redisClient;
}

// Graceful shutdown
process.on("SIGTERM", async () => {
    if (redisClient) {
        await redisClient.quit();
    }
});

module.exports = { getRedisClient };
