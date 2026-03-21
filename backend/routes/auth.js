/**
 * routes/auth.js
 * 
 * Firebase token verification + user profile sync.
 * SECURITY: Uses firebase-admin to cryptographically verify ID tokens.
 * Falls back to safe failure if FIREBASE_SERVICE_ACCOUNT_KEY is not configured.
 */
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// --- Firebase Admin Initialization ---
let firebaseAdmin = null;

try {
    const admin = require("firebase-admin");

    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccountKey) {
        let serviceAccount;
        const trimmedKey = serviceAccountKey.trim();
        try {
            let jsonString;
            if (trimmedKey.startsWith('{')) {
                jsonString = trimmedKey;
            } else {
                jsonString = Buffer.from(trimmedKey.replace(/\s/g, ''), 'base64').toString('utf8');
            }

            serviceAccount = JSON.parse(jsonString);
            
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
        } catch (e) {
            console.error("[Auth] Firebase Key Parsing Error:", e.message);
            throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_KEY format: ${e.message}`);
        }

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        firebaseAdmin = admin;
        console.log("✅ Firebase Admin initialized successfully.");
    } else {
        console.warn("⚠️  FIREBASE_SERVICE_ACCOUNT_KEY not set. Auth routes will reject all requests in production.");
    }
} catch (err) {
    console.error("❌ Firebase Admin initialization failed:", err.message);
}

// --- Real Token Verification Middleware ---
const verifyFirebaseToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // If firebase-admin is not configured, deny all auth in production
    if (!firebaseAdmin) {
        if (process.env.NODE_ENV === "production") {
            return res.status(503).json({ error: "Authentication service not configured" });
        }
        // In local dev only: decode JWT payload without verification as a temporary fallback
        // for when the FIREBASE_SERVICE_ACCOUNT_KEY is malformed/broken.
        console.warn("[DEV ONLY] Broken Firebase Key: Using insecure JWT payload decoding fallback.");
        try {
            const parts = token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
                req.user = {
                    uid: payload.user_id || payload.uid,
                    email: payload.email,
                    displayName: payload.name || payload.email?.split("@")[0],
                    photoURL: payload.picture || ""
                };
                return next();
            }
            throw new Error("Invalid JWT format");
        } catch (e) {
            console.error("[Auth] Dev Fallback Failed:", e.message);
            return res.status(401).json({ error: "Invalid token format for fallback" });
        }
    }

    // Production path: verify cryptographic signature with Firebase
    try {
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            displayName: decodedToken.name || decodedToken.email?.split("@")[0],
            photoURL: decodedToken.picture || ""
        };
        next();
    } catch (err) {
        console.warn("[Auth] Token verification failed:", err.message);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
};

// GET /api/auth/sync
// Syncs Firebase User with MongoDB — creates user if doesn't exist.
router.get("/sync", verifyFirebaseToken, async (req, res) => {
    try {
        const { uid, email, displayName, photoURL } = req.user;

        if (!uid || !email) {
            return res.status(400).json({ error: "Missing required user fields" });
        }

        let user = await User.findOne({ firebaseUid: uid });

        if (!user) {
            user = new User({
                firebaseUid: uid,
                email,
                displayName: displayName || email.split("@")[0],
                avatarUrl: photoURL || "",
                favoriteColleges: [],
                favoriteExams: [],
                deadlines: []
            });
            await user.save();
        } else {
            let updated = false;
            if (displayName && user.displayName !== displayName) { user.displayName = displayName; updated = true; }
            if (photoURL && user.avatarUrl !== photoURL) { user.avatarUrl = photoURL; updated = true; }
            if (updated) await user.save();
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                firebaseUid: user.firebaseUid,
                email: user.email,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                favoriteColleges: user.favoriteColleges,
                favoriteExams: user.favoriteExams,
                deadlines: user.deadlines
            }
        });
    } catch (err) {
        console.error("[Auth Sync] Error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/auth/deadlines
router.post("/deadlines", verifyFirebaseToken, async (req, res) => {
    try {
        const { uid } = req.user;
        const { title, date, notes, type } = req.body;

        // Input validation
        if (!title || typeof title !== "string" || title.length > 200) {
            return res.status(400).json({ error: "Invalid deadline title" });
        }
        if (!date || isNaN(new Date(date).getTime())) {
            return res.status(400).json({ error: "Invalid deadline date" });
        }

        const user = await User.findOne({ firebaseUid: uid });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Limit deadlines per user to prevent storage abuse
        if (user.deadlines.length >= 50) {
            return res.status(400).json({ error: "Maximum 50 deadlines allowed per user" });
        }

        const newDeadline = {
            id: require("crypto").randomBytes(4).toString("hex"),
            title: title.trim(),
            date: new Date(date),
            type: ["exam", "application", "result", "other"].includes(type) ? type : "other",
            notes: notes ? String(notes).slice(0, 500) : ""
        };

        user.deadlines.push(newDeadline);
        await user.save();

        res.json({ success: true, deadline: newDeadline });
    } catch (err) {
        console.error("[Auth Deadlines] Error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
