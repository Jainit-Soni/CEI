const Redis = require("ioredis");

let redisClient = null;
let lastError = null;
let lastClose = false;
let breakerUntil = 0; // Timestamp when circuit breaker resets

function createRedisClient() {
    if (redisClient) {
        return redisClient;
    }

    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    redisClient = new Redis(redisUrl, {
        retryStrategy(times) {
            // If breaker is active, don't even try to reconnect
            if (Date.now() < breakerUntil) return null;
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
        breakerUntil = 0; // Reset breaker on successful manual connection
    });

    redisClient.on("error", (err) => {
        // Detect Upstash / Redis quota limits
        if (err.message.includes("max requests limit exceeded") || err.message.includes("quota exceeded")) {
             if (Date.now() > breakerUntil) {
                 const COOLDOWN_MINUTES = 10;
                 breakerUntil = Date.now() + (COOLDOWN_MINUTES * 60 * 1000);
                 console.warn(`🚨 REDIS QUOTA: Circuit Breaker active for ${COOLDOWN_MINUTES}m. Switching to local-only mode.`);
             }
             return;
        }

        // Only log unique errors once to avoid spamming the console
        if (err.message !== lastError) {
            console.error("❌ Redis error:", err.message);
            lastError = err.message;
        }
    });

    redisClient.on("close", () => {
        if (!lastClose && Date.now() > breakerUntil) {
            console.log("⚠️  Redis connection closed.");
            lastClose = true;
        }
    });

    return redisClient;
}

async function getRedisClient() {
    // 1. Check Circuit Breaker
    if (Date.now() < breakerUntil) {
        return null;
    }

    if (!redisClient) {
        redisClient = createRedisClient();
    }

    // Check status to avoid "already connecting/connected" errors
    const status = redisClient.status;

    if (status === "ready" || status === "connect") {
        return redisClient;
    }

    if (status === "connecting" || status === "reconnecting") {
        // Wait for it to be ready with a short timeout
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve(null);
            }, 100);

            redisClient.once("ready", () => {
                clearTimeout(timeout);
                resolve(redisClient);
            });

            redisClient.once("error", () => {
                clearTimeout(timeout);
                resolve(null);
            });
        });
    }

    try {
        const connectionPromise = redisClient.connect();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Redis connection timeout")), 500) // Slightly longer timeout
        );

        await Promise.race([connectionPromise, timeoutPromise]);
        return redisClient;
    } catch (err) {
        if (err.message.includes("already connecting") || err.message.includes("already connected")) {
            return redisClient;
        }
        // Silence log on timeout/standard end to prevent spam
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
