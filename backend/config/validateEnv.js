/**
 * validateEnv.js
 * 
 * Validates required environment variables at startup.
 * Logs clear errors and exits in production if critical vars are missing.
 */

const REQUIRED_VARS = ['MONGODB_URI'];
const WARN_VARS = ['REDIS_URL', 'ADMIN_SECRET'];

function validateEnv() {
    const missing = REQUIRED_VARS.filter(v => !process.env[v]);

    if (missing.length > 0) {
        console.error('❌ FATAL: Missing required environment variables:', missing.join(', '));
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }

    const missingWarn = WARN_VARS.filter(v => !process.env[v]);
    if (missingWarn.length > 0) {
        console.warn('⚠️  Missing optional environment variables (degraded functionality):', missingWarn.join(', '));
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_SECRET) {
        console.warn('⚠️  WARNING: ADMIN_SECRET is not set. Admin routes will be disabled.');
    }
}

module.exports = validateEnv;
