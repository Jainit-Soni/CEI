const Redis = require("ioredis");

let redisClient = null;
let lastError = null;
let lastClose = false;

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
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        lazyConnect: true,
    });

    redisClient.on("connect", () => {
        console.log("✅ Redis connected");
        lastError = null;
        lastClose = false;
    });

    redisClient.on("error", (err) => {
        // Only log unique errors once to avoid spamming the console in fail-safe mode
        if (err.message !== lastError) {
            console.error("❌ Redis error:", err.message);
            lastError = err.message;
        }
    });

    redisClient.on("close", () => {
        if (!lastClose) {
            console.log("⚠️  Redis connection closed. (Warnings silenced for this session)");
            lastClose = true;
        }
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
        // Wait for it to be ready with a timeout
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                // Only warn once about timeout
                if (!lastError) {
                    console.warn("⚠️  Redis ready timeout. Proceeding without cache.");
                }
                resolve(null);
            }, 2000);

            redisClient.once("ready", () => {
                clearTimeout(timeout);
                resolve(redisClient);
            });

            redisClient.once("error", (err) => {
                clearTimeout(timeout);
                if (err.message !== lastError) {
                    console.warn(`⚠️  Redis error during wait: ${err.message}`);
                    lastError = err.message;
                }
                resolve(null);
            });
        });
    }

    // Only connect if it's actually disconnected/end
    try {
        // Add a 2s timeout to the connection attempt
        const connectionPromise = redisClient.connect();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Redis connection timeout")), 2000)
        );

        await Promise.race([connectionPromise, timeoutPromise]);
        return redisClient;
    } catch (err) {
        if (err.message.includes("already connecting")) {
            return redisClient;
        }
        if (err.message !== lastError) {
            console.warn(`⚠️  Redis connection issue: ${err.message}. Proceeding without cache.`);
            lastError = err.message;
        }
        return null;
    }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
    if (redisClient) {
        await redisClient.quit();
    }
});

module.exports = { getRedisClient };
