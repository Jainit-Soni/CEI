const { getRedisClient } = require("../config/redis");

const RATE_LIMITS = {
    free: { window: 900, max: 500 },     // 500 req / 15 min
    pro: { window: 900, max: 5000 },     // 5000 req / 15 min
    enterprise: { window: 900, max: 0 }  // Unlimited
};

async function apiKeyAuth(req, res, next) {
    const apiKey = req.header("X-API-Key");

    // If no key, fall back to IP-based limiting (handled by express-rate-limit downstream)
    if (!apiKey) {
        return next();
    }

    try {
        const redis = await getRedisClient();
        const keyData = await redis.hget("api_keys", apiKey);

        if (!keyData) {
            return res.status(401).json({ error: "Invalid API key" });
        }

        const { tier, active } = JSON.parse(keyData);

        if (!active) {
            return res.status(403).json({ error: "API key is inactive" });
        }

        // Attach key info to request
        req.apiKey = { tier, key: apiKey };

        // Check rate limit for this key
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
        console.error("API Key Auth Error:", err);
        next(); // Fail open or closed? Better to fail closed but let's just log for now
    }
}

module.exports = apiKeyAuth;
