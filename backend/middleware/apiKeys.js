/**
 * middleware/apiKeys.js
 * 
 * API Key authentication + rate limiting middleware.
 * SECURITY: Fails CLOSED on Redis errors — does not pass through on auth failure.
 */
const { getRedisClient } = require("../config/redis");

const RATE_LIMITS = {
    free: { window: 900, max: 500 },       // 500 req / 15 min
    pro: { window: 900, max: 5000 },       // 5000 req / 15 min
    enterprise: { window: 900, max: 0 }    // Unlimited
};

async function apiKeyAuth(req, res, next) {
    const apiKey = req.header("X-API-Key");

    // No API key — fall through to IP-based rate limit (handled by express-rate-limit in server.js)
    if (!apiKey) {
        return next();
    }

    let redis;
    try {
        redis = await getRedisClient();
    } catch (err) {
        console.error("[apiKeyAuth] Redis connection error:", err.message);
        // FAIL CLOSED: do not grant access if auth layer is broken
        return res.status(503).json({ error: "Authentication service temporarily unavailable. Please retry." });
    }

    if (!redis) {
        if (process.env.NODE_ENV === "development") {
            console.warn("[apiKeyAuth] Redis unavailable in development. Skipping API key validation.");
            return next();
        }
        // Redis unavailable — fail closed for API key requests to prevent auth bypass
        return res.status(503).json({ error: "Authentication service temporarily unavailable. Please retry." });
    }

    try {
        const keyData = await redis.hget("api_keys", apiKey);

        if (!keyData) {
            return res.status(401).json({ error: "Invalid API key" });
        }

        const parsed = JSON.parse(keyData);
        const { tier, active } = parsed;

        if (!active) {
            return res.status(403).json({ error: "API key is inactive" });
        }

        // Attach key info to request
        req.apiKey = { tier, key: apiKey };

        // Rate limiting per key
        const limits = RATE_LIMITS[tier] || RATE_LIMITS.free;

        if (limits.max > 0) {
            const usageKey = `usage:${apiKey}`;
            const current = await redis.incr(usageKey);

            if (current === 1) {
                await redis.expire(usageKey, limits.window);
            }

            if (current > limits.max) {
                return res.status(429).json({
                    error: "Rate limit exceeded for this API key",
                    limit: limits.max,
                    retryAfter: await redis.ttl(usageKey)
                });
            }

            res.setHeader("X-RateLimit-Limit", limits.max);
            res.setHeader("X-RateLimit-Remaining", Math.max(0, limits.max - current));
        }

        next();
    } catch (err) {
        console.error("[apiKeyAuth] Unexpected error during key validation:", err.message);
        // FAIL CLOSED: any unexpected error denies access
        return res.status(503).json({ error: "Authentication service error. Please retry." });
    }
}

module.exports = apiKeyAuth;
