/**
 * lib/jwtAuth.js — CEI JWT Governance Authentication
 * ====================================================
 * Replaces static X-Admin-Secret with short-lived HMAC-SHA256 JWTs.
 * Includes: issue, verify, revoke via Redis allowlist.
 *
 * Roles: super_admin | reviewer | auditor
 * Token lifetime: 8h access, 7d refresh
 * Revocation: JTI stored in Redis until token expiry
 */

const crypto = require('crypto');
const { getRedisClient } = require('../config/redis');
const logger = (() => { try { return require('./logger'); } catch { return console; } })();

// ── Constants ──────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET must be set in production');
    }
    logger.warn('[JWTAuth] JWT_SECRET not set — using insecure dev default. Set JWT_SECRET in env.');
    return 'dev-insecure-jwt-secret-change-in-production';
})();

const REVOCATION_PREFIX = 'jwt:revoked:';

// ── Lightweight JWT (no external dependency) ──────────────────────────────────

function base64url(input) {
    return Buffer.from(input).toString('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(input) {
    return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/**
 * Issue a signed JWT.
 * @param {object} payload — { role, sub }
 * @param {string} expiresIn — '8h' | '7d' | custom seconds as number
 * @returns {string} - signed JWT string
 */
function issueToken(payload, expiresIn = '8h') {
    const header = { alg: 'HS256', typ: 'JWT' };
    const iat = Math.floor(Date.now() / 1000);

    // Parse expiresIn
    let exp;
    if (typeof expiresIn === 'number') {
        exp = iat + expiresIn;
    } else if (expiresIn.endsWith('h')) {
        exp = iat + parseInt(expiresIn) * 3600;
    } else if (expiresIn.endsWith('d')) {
        exp = iat + parseInt(expiresIn) * 86400;
    } else {
        exp = iat + 28800; // default 8h
    }

    const jti = crypto.randomBytes(16).toString('hex');
    const fullPayload = { ...payload, iat, exp, jti };

    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(fullPayload));
    const sig = base64url(
        crypto.createHmac('sha256', JWT_SECRET)
            .update(`${headerB64}.${payloadB64}`)
            .digest()
    );

    return `${headerB64}.${payloadB64}.${sig}`;
}

/**
 * Verify a JWT string.
 * Returns decoded payload or throws an error with a code property.
 *
 * Error codes: TOKEN_EXPIRED | TOKEN_MALFORMED | TOKEN_INVALID_SIGNATURE | TOKEN_REVOKED
 */
async function verifyToken(token) {
    if (!token || typeof token !== 'string') {
        const e = new Error('Token is required'); e.code = 'TOKEN_MALFORMED'; throw e;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
        const e = new Error('Malformed JWT'); e.code = 'TOKEN_MALFORMED'; throw e;
    }

    const [headerB64, payloadB64, sigB64] = parts;

    // Verify signature
    const expectedSig = base64url(
        crypto.createHmac('sha256', JWT_SECRET)
            .update(`${headerB64}.${payloadB64}`)
            .digest()
    );

    if (!crypto.timingSafeEqual(Buffer.from(sigB64), Buffer.from(expectedSig))) {
        const e = new Error('Invalid token signature'); e.code = 'TOKEN_INVALID_SIGNATURE'; throw e;
    }

    let payload;
    try {
        payload = JSON.parse(base64urlDecode(payloadB64));
    } catch {
        const e = new Error('Malformed payload'); e.code = 'TOKEN_MALFORMED'; throw e;
    }

    // Check expiry
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
        const e = new Error('Token has expired'); e.code = 'TOKEN_EXPIRED'; throw e;
    }

    // Check revocation list
    if (payload.jti) {
        const revoked = await isRevoked(payload.jti);
        if (revoked) {
            const e = new Error('Token has been revoked'); e.code = 'TOKEN_REVOKED'; throw e;
        }
    }

    return payload;
}

/**
 * Revoke a token by its JTI. Stored in Redis until natural expiry.
 * @param {string} jti — Token JTI from decoded payload
 * @param {number} exp — Token expiry epoch (for Redis TTL)
 */
async function revokeToken(jti, exp) {
    try {
        const redis = getRedisClient();
        if (!redis) return false;
        const ttl = exp ? Math.max(1, exp - Math.floor(Date.now() / 1000)) : 86400;
        await redis.set(`${REVOCATION_PREFIX}${jti}`, '1', { EX: ttl });
        logger.audit('[JWTAuth] Token revoked', { jti });
        return true;
    } catch (err) {
        logger.error('[JWTAuth] Failed to revoke token', { jti, error: err.message });
        return false;
    }
}

/**
 * Check if a JTI is in the revocation list.
 */
async function isRevoked(jti) {
    try {
        const redis = getRedisClient();
        if (!redis) return false;
        const val = await redis.get(`${REVOCATION_PREFIX}${jti}`);
        return val === '1';
    } catch {
        return false; // Fail open on Redis error (token still validated by signature)
    }
}

/**
 * Express middleware factory.
 * Usage: router.get('/protected', requireRole('super_admin', 'reviewer'), handler)
 *
 * Also accepts legacy X-Admin-Secret for 30-day grace period (logged as DEPRECATED).
 */
function requireRole(...allowedRoles) {
    return async (req, res, next) => {
        // ── Grace period: legacy X-Admin-Secret ──────────────────────────────
        const legacySecret = req.headers['x-admin-secret'];
        if (legacySecret && process.env.ADMIN_SECRET && legacySecret === process.env.ADMIN_SECRET) {
            logger.warn('[JWTAuth] DEPRECATED_AUTH: X-Admin-Secret used — migrate to JWT tokens', {
                route: req.originalUrl,
                ip: req.ip,
                requestId: req.id
            });
            req.admin = { role: 'super_admin', via: 'legacy_secret' };
            return next();
        }

        // ── JWT Bearer token ───────────────────────────────────────────────
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authentication required. Use: Authorization: Bearer <token>',
                hint: 'Get a token via POST /api/admin-auth/login'
            });
        }

        const token = authHeader.slice(7);

        try {
            const payload = await verifyToken(token);

            // Role check
            if (allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
                logger.warn('[JWTAuth] Role denied', { required: allowedRoles, got: payload.role, route: req.originalUrl });
                return res.status(403).json({
                    error: `Insufficient role. Required: ${allowedRoles.join(' | ')}. Your role: ${payload.role}`
                });
            }

            req.admin = payload;
            next();
        } catch (err) {
            const status = err.code === 'TOKEN_EXPIRED' ? 401 : 403;
            return res.status(status).json({ error: err.message, code: err.code });
        }
    };
}

module.exports = { issueToken, verifyToken, revokeToken, isRevoked, requireRole };
