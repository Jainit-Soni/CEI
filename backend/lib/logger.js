/**
 * lib/logger.js — CEI Structured JSON Logger
 * ============================================
 * Every log line is a valid JSON object for ingestion by Sentry, Datadog, or CloudWatch.
 * Format: { level, timestamp, requestId, route, durationMs, status, message, ...meta }
 */

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, AUDIT: 4 };
const MIN_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG');

function log(level, message, meta = {}) {
    if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LEVEL]) return;

    const entry = {
        level,
        timestamp: new Date().toISOString(),
        service: 'cei-backend',
        env: process.env.NODE_ENV || 'development',
        message,
        ...meta
    };

    const line = JSON.stringify(entry);

    if (level === 'ERROR') {
        process.stderr.write(line + '\n');
    } else {
        process.stdout.write(line + '\n');
    }
}

const logger = {
    debug: (msg, meta) => log('DEBUG', msg, meta),
    info: (msg, meta) => log('INFO', msg, meta),
    warn: (msg, meta) => log('WARN', msg, meta),
    error: (msg, meta) => log('ERROR', msg, meta),
    audit: (msg, meta) => log('AUDIT', msg, meta), // Security-sensitive events
};

module.exports = logger;
