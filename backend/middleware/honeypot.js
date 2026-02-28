/**
 * middleware/honeypot.js — CEI Anti-Scraping Trap Layer
 * =======================================================
 * Registers fake-looking "admin" endpoints that no legitimate user would ever
 * visit. Any hit is treated as a scraping bot or adversarial probe — the IP
 * is logged with a Redis fingerprint and added to a block list.
 *
 * Honeypot endpoints:
 *   /api/admin/dump
 *   /api/backup
 *   /api/export-all
 *   /api/internal/data
 *   /api/v0/colleges     (old version probe)
 */

const { getRedisClient } = require('../config/redis');
const logger = require('../lib/logger');

const HONEYPOT_PATHS = [
    '/api/admin/dump',
    '/api/backup',
    '/api/export-all',
    '/api/internal/data',
    '/api/v0/colleges',
    '/api/scrape',
    '/api/download',
];

const BLOCK_TTL = 86400; // 24 hours block

async function honeypotMiddleware(req, res, next) {
    if (!HONEYPOT_PATHS.includes(req.path)) return next();

    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const ua = req.headers['user-agent'] || '';

    logger.audit('HONEYPOT_HIT', {
        requestId: req.id,
        ip,
        path: req.path,
        method: req.method,
        userAgent: ua,
        severity: 'HIGH',
    });

    // Add to Redis block list
    try {
        const redis = await getRedisClient();
        if (redis) {
            const blockKey = `honeypot:blocked:${ip}`;
            await redis.set(blockKey, JSON.stringify({ reason: 'honeypot', path: req.path, ts: Date.now() }), 'EX', BLOCK_TTL);
        }
    } catch (e) { /* Non-blocking */ }

    // Return convincing but fake 200 response (don't tip off the bot)
    return res.status(200).json({ status: 'ok', data: [] });
}

// Block middleware — checks if IP is in honeypot block list
async function honeypotBlockCheck(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    try {
        const redis = await getRedisClient();
        if (redis) {
            const blocked = await redis.get(`honeypot:blocked:${ip}`);
            if (blocked) {
                logger.warn('BLOCKED_IP_REQUEST', { requestId: req.id, ip, path: req.path });
                return res.status(403).json({ error: 'Access denied.' });
            }
        }
    } catch (e) { /* Non-blocking — fail open for performance */ }
    next();
}

module.exports = { honeypotMiddleware, honeypotBlockCheck };
