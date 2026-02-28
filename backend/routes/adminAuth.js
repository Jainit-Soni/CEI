/**
 * routes/adminAuth.js — CEI Governance JWT Token Issuance
 * =========================================================
 * Issues, refreshes, and revokes short-lived JWTs for admin access.
 *
 *   POST /api/admin-auth/login   — Authenticate with secret, get JWT
 *   POST /api/admin-auth/refresh — Rotate a valid JWT for a new one
 *   POST /api/admin-auth/revoke  — Revoke a JTI (super_admin only)
 */

const express = require('express');
const router = express.Router();
const { issueToken, verifyToken, revokeToken, requireRole } = require('../lib/jwtAuth');
const logger = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// Role → required secret env var mapping
const ROLE_SECRETS = {
    super_admin: () => process.env.ADMIN_SECRET,
    reviewer: () => process.env.REVIEWER_SECRET || process.env.ADMIN_SECRET,
    auditor: () => process.env.AUDITOR_SECRET || process.env.ADMIN_SECRET
};

const TOKEN_EXPIRY = {
    super_admin: '8h',
    reviewer: '8h',
    auditor: '24h'
};

// Rate limiting: simple in-process counter (use Redis in production at scale)
const loginAttempts = new Map();
function isRateLimited(ip) {
    const now = Date.now();
    const record = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
    if (now > record.resetAt) { record.count = 0; record.resetAt = now + 15 * 60 * 1000; }
    record.count++;
    loginAttempts.set(ip, record);
    return record.count > 10; // 10 attempts per 15 min
}

/**
 * POST /api/admin-auth/login
 * Body: { secret: string, role: "super_admin"|"reviewer"|"auditor" }
 * Returns: { token, role, expiresIn }
 */
router.post('/login', (req, res) => {
    const ip = req.ip || 'unknown';
    if (isRateLimited(ip)) {
        logger.warn('[AdminAuth] Rate limit hit on login', { ip });
        return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
    }

    const { secret, role = 'super_admin' } = req.body;

    if (!secret) {
        return res.status(400).json({ error: 'secret is required in request body.' });
    }

    const VALID_ROLES = Object.keys(ROLE_SECRETS);
    if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Valid: ${VALID_ROLES.join(', ')}` });
    }

    const expectedSecret = ROLE_SECRETS[role]();
    if (!expectedSecret) {
        return res.status(503).json({ error: 'Authentication not configured for this role.' });
    }

    // Constant-time comparison to prevent timing attacks
    const crypto = require('crypto');
    const secretBuf = Buffer.from(secret);
    const expectedBuf = Buffer.from(expectedSecret);

    let match = false;
    try {
        match = secretBuf.length === expectedBuf.length &&
            crypto.timingSafeEqual(secretBuf, expectedBuf);
    } catch { match = false; }

    if (!match) {
        logger.warn('[AdminAuth] Failed login attempt', { role, ip });
        return res.status(401).json({ error: 'Invalid secret.' });
    }

    const expiresIn = TOKEN_EXPIRY[role];
    const token = issueToken({ role, sub: `cei-admin-${role}` }, expiresIn);

    logger.audit('[AdminAuth] JWT issued', { role, ip, expiresIn });
    res.json({ token, role, expiresIn, message: `Welcome. Token valid for ${expiresIn}.` });
});

/**
 * POST /api/admin-auth/refresh
 * Header: Authorization: Bearer <token>
 * Returns: { token, role, expiresIn }
 */
router.post('/refresh', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Provide current token in Authorization: Bearer <token>' });
    }

    const oldToken = authHeader.slice(7);
    try {
        const payload = await verifyToken(oldToken);

        // Revoke the old token before issuing a new one
        await revokeToken(payload.jti, payload.exp);

        const expiresIn = TOKEN_EXPIRY[payload.role] || '8h';
        const newToken = issueToken({ role: payload.role, sub: payload.sub }, expiresIn);

        logger.audit('[AdminAuth] JWT rotated', { role: payload.role, ip: req.ip });
        res.json({ token: newToken, role: payload.role, expiresIn });
    } catch (err) {
        res.status(401).json({ error: err.message, code: err.code });
    }
});

/**
 * POST /api/admin-auth/revoke
 * Header: Authorization: Bearer <super_admin token>
 * Body: { jti: string, exp: number } — JTI to revoke
 * (super_admin only)
 */
router.post('/revoke', requireRole('super_admin'), async (req, res) => {
    const { jti, exp } = req.body;
    if (!jti) return res.status(400).json({ error: 'jti is required.' });

    const success = await revokeToken(jti, exp);
    logger.audit('[AdminAuth] Manual JWT revocation', { jti, by: req.admin?.sub, ip: req.ip });
    res.json({ success, jti, message: success ? 'Token revoked.' : 'Revocation stored (no Redis confirmation).' });
});

module.exports = router;
