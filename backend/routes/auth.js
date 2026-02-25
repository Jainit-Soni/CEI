const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Middleware to mock Firebase Admin token verification for now
// (In production, replace with actual firebase-admin verifyIdToken)
const verifyFirebaseMock = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    // For our hybrid approach, the frontend sends a custom payload
    // JSON: { uid, email, displayName, photoURL } encoded in Base64
    try {
        const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid token format" });
    }
};

// GET /api/auth/sync
// Syncs Firebase User with MongoDB. Creates user if doesn't exist.
router.get("/sync", verifyFirebaseMock, async (req, res) => {
    try {
        const { uid, email, displayName, photoURL } = req.user;

        if (!uid || !email) {
            return res.status(400).json({ error: "Missing required user fields" });
        }

        // Find or Create User
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
            // Update profile info if changed on Firebase end
            let updated = false;
            if (displayName && user.displayName !== displayName) {
                user.displayName = displayName;
                updated = true;
            }
            if (photoURL && user.avatarUrl !== photoURL) {
                user.avatarUrl = photoURL;
                updated = true;
            }
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
// Add a custom deadline
router.post("/deadlines", verifyFirebaseMock, async (req, res) => {
    try {
        const { uid } = req.user;
        const { title, date, notes, type } = req.body;

        const user = await User.findOne({ firebaseUid: uid });
        if (!user) return res.status(404).json({ error: "User not found" });

        const newDeadline = {
            id: require('crypto').randomBytes(4).toString('hex'),
            title,
            date: new Date(date),
            type: type || "other",
            notes
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
