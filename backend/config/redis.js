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

    // Check status to avoid "already connecting/connected" errors
    const status = redisClient.status;

    if (status === "ready" || status === "connect") {
        return redisClient;
    }

    if (status === "connecting" || status === "reconnecting") {
        // Wait for it to be ready
        return new Promise((resolve) => {
            redisClient.once("ready", () => resolve(redisClient));
            // Also handle potential errors during this wait
            redisClient.once("error", () => resolve(redisClient));
        });
    }

    // Only connect if it's actually disconnected/end
    try {
        await redisClient.connect();
    } catch (err) {
        if (!err.message.includes("already connecting")) {
            throw err;
        }
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
