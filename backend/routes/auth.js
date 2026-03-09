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
            // Check if it's base64 encoded (common in Vercel/Production)
            if (trimmedKey.startsWith('{')) {
                jsonString = trimmedKey;
            } else {
                // Ensure we remove any whitespace that might break base64 decoding
                const cleanBase64 = trimmedKey.replace(/\s/g, '');
                jsonString = Buffer.from(cleanBase64, 'base64').toString('utf8');
            }

            // FINAL ROBUST SCRUB: Remove all literal newlines, carriage returns, and tabs.
            // These are not allowed inside JSON string literals and can be safely 
            // removed from the structural parts of the JSON if it's not minified.
            // This preserves the literal '\\n' sequences used in the private_key.
            const finalScrub = (str) => {
                return str
                    .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ') // Replace all control chars with space
                    .replace(/\s+/g, ' ')                  // Collapse all whitespace to single spaces
                    .trim();
            };

            const cleanedStr = finalScrub(jsonString);

            try {
                serviceAccount = JSON.parse(cleanedStr);
            } catch (e1) {
                console.error("[Auth] Primary cleaned parse failed:", e1.message);
                // Fallback: try raw string
                serviceAccount = JSON.parse(jsonString);
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
        // In local dev only: decode Base64 payload as a dev convenience
        // DO NOT use this fallback in production
        console.warn("[DEV ONLY] Using insecure Base64 token fallback. Configure FIREBASE_SERVICE_ACCOUNT_KEY.");
        try {
            const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
            req.user = decoded;
            return next();
        } catch {
            return res.status(401).json({ error: "Invalid token format" });
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
