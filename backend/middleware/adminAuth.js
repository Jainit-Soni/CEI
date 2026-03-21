/**
 * middleware/adminAuth.js — CEI Firebase Admin Authentication
 * ============================================================
 * Verifies Firebase ID tokens and enforces a strict email whitelist.
 * This is the ONLY authentication mechanism for all admin routes.
 *
 * FLOW:
 *   1. Extract Bearer token from Authorization header
 *   2. Verify with Firebase Admin SDK (checks signature + expiry)
 *   3. Extract email from decoded token
 *   4. Check against ADMIN_WHITELIST — 403 if not listed
 *   5. Attach { email, uid } to req.admin
 *   6. Log action to AdminAuditLog (non-blocking)
 *   7. next()
 *
 * NEVER trust the frontend email check — always verify server-side.
 */

'use strict';

const admin = require('firebase-admin');
const AdminAuditLog = require('../models/AdminAuditLog');
const logger = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// ── Admin Whitelist ───────────────────────────────────────────────────────────
// The ONLY two email addresses allowed to access admin endpoints.
// Any change here requires a server restart.
const ADMIN_WHITELIST = [
    'jainitsoni07@gmail.com',
    'jainit.developer@gmail.com',
];

// ── Firebase Admin SDK Init ───────────────────────────────────────────────────
// Lazily initialized once on first use. Handles already-initialized apps.
let firebaseApp = null;

function getFirebaseApp() {
    if (firebaseApp) return firebaseApp;

    // If Firebase is already initialized by another module, reuse it
    if (admin.apps.length > 0) {
        firebaseApp = admin.apps[0];
        return firebaseApp;
    }

    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountRaw) {
        logger.error('[AdminAuth] FIREBASE_SERVICE_ACCOUNT_KEY not set — admin auth will reject all requests');
        return null;
    }

    try {
        const serviceAccount = JSON.parse(
            Buffer.from(serviceAccountRaw, 'base64').toString('utf8')
        );

        // Critical fix for private_key newline formatting & ASN.1 cleanup
        if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
            let pk = serviceAccount.private_key;
            
            // 1. Convert literal \n to real newlines
            pk = pk.replace(/\\n/g, '\n');
            
            // 2. Remove any carriage returns
            pk = pk.replace(/\r/g, '');
            
            // 3. Reformat with strict 64-char lines to ensure max compatibility
            const header = "-----BEGIN PRIVATE KEY-----";
            const footer = "-----END PRIVATE KEY-----";
            let body = pk.replace(header, "").replace(footer, "").replace(/\s/g, "");
            
            // Rebuild with standard 64-char wrapping
            const lines = body.match(/.{1,64}/g);
            if (lines) {
                pk = `${header}\n${lines.join('\n')}\n${footer}`;
            }
            
            serviceAccount.private_key = pk;
        }

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        logger.info('[AdminAuth] Firebase Admin SDK initialized');
        return firebaseApp;
    } catch (err) {
        logger.error('[AdminAuth] Failed to initialize Firebase Admin SDK', { error: err.message });
        return null;
    }
}

// ── Audit Logger (fire-and-forget) ────────────────────────────────────────────
function auditLog(req, adminEmail, adminUid) {
    const action = `${req.method} ${req.path}`;
    const meta = Object.keys(req.body || {}).length > 0
        ? JSON.stringify(req.body).substring(0, 200)
        : null;

    AdminAuditLog.create({
        adminEmail,
        adminUid,
        action,
        resource: req.originalUrl,
        method: req.method,
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        userAgent: req.headers['user-agent']?.substring(0, 300) || null,
        meta,
    }).catch(err => {
        logger.warn('[AdminAuth] Audit log write failed', { error: err.message });
    });
}

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * adminAuth — Express middleware
 *
 * Attach to any route that must be restricted to admin-only access:
 *   router.get('/sensitive', adminAuth, handler)
 */
async function adminAuth(req, res, next) {
    // ── 1. Extract token ────────────────────────────────────────────────────
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Authentication required.',
            hint: 'Sign in with Google on the admin panel to get a token.',
        });
    }

    const idToken = authHeader.slice(7);

    // ── 2. Ensure Firebase App is initialized ───────────────────────────────
    const app = getFirebaseApp();
    if (!app) {
        logger.error('[AdminAuth] Firebase not configured — rejecting request');
        return res.status(503).json({
            error: 'Admin authentication is not configured on this server.',
            hint: 'Set FIREBASE_SERVICE_ACCOUNT_KEY in environment variables.',
        });
    }

    // ── 3. Verify Firebase ID Token ─────────────────────────────────────────
    let decoded;
    try {
        decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
        const isExpired = err.code === 'auth/id-token-expired';
        logger.warn('[AdminAuth] Token verification failed', { code: err.code, ip: req.ip });
        return res.status(isExpired ? 401 : 403).json({
            error: isExpired ? 'Session expired. Please sign in again.' : 'Invalid or tampered token.',
            code: err.code,
        });
    }

    // ── 4. Whitelist check ──────────────────────────────────────────────────
    const email = decoded.email?.toLowerCase();
    if (!email || !ADMIN_WHITELIST.includes(email)) {
        logger.warn('[AdminAuth] Unauthorized email attempt', { email, ip: req.ip });
        return res.status(403).json({
            error: 'Access denied. This account is not authorized to access the admin panel.',
            email: email || 'unknown',
        });
    }

    // ── 5. Attach admin identity to request ─────────────────────────────────
    req.admin = {
        email,
        uid: decoded.uid,
        name: decoded.name || null,
        picture: decoded.picture || null,
    };

    // ── 6. Audit log (non-blocking) ─────────────────────────────────────────
    auditLog(req, email, decoded.uid);

    // ── 7. Proceed ──────────────────────────────────────────────────────────
    next();
}

module.exports = adminAuth;
module.exports.ADMIN_WHITELIST = ADMIN_WHITELIST;
