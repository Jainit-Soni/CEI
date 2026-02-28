/**
 * middleware/requestLogger.js — CEI Request Tracing
 * ==================================================
 * Assigns a unique requestId to every incoming request.
 * Logs method, path, IP, latency, and status on completion.
 * Compatible with the structured JSON logger.
 */

const { randomUUID } = require('crypto');
const logger = require('../lib/logger');

function requestLogger(req, res, next) {
    req.id = randomUUID();
    req.start = Date.now();

    // Attach requestId to response headers for client-side correlation
    res.setHeader('X-Request-ID', req.id);

    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    res.on('finish', () => {
        const durationMs = Date.now() - req.start;
        const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';

        logger[level.toLowerCase()]('HTTP Request', {
            requestId: req.id,
            method: req.method,
            route: req.originalUrl,
            status: res.statusCode,
            durationMs,
            ip: clientIp,
            userAgent: req.headers['user-agent'] || '',
            apiKey: req.apiKey?.tier ? `[${req.apiKey.tier}]` : 'anon',
        });
    });

    next();
}

module.exports = requestLogger;
