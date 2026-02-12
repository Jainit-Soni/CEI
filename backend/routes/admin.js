const express = require("express");
const router = express.Router();
const { saveCollege, deleteCollege, getColleges, invalidateCache } = require("../services/dataStore");

// Simple Admin Middleware
const requireAdmin = (req, res, next) => {
    const adminSecret = req.headers["x-admin-secret"];
    // For now, hardcoded secret or env var. 
    // In production, this should be validated properly or use Firebase Auth token verification.
    // STRICT SECURITY: No fallback allowed in production
    const { ADMIN_SECRET } = process.env;

    if (!ADMIN_SECRET) {
        console.error("CRITICAL: ADMIN_SECRET is not set in environment variables.");
        return res.status(500).json({ error: "Server configuration error" });
    }

    if (adminSecret !== ADMIN_SECRET) {
        return res.status(403).json({ error: "Unauthorized" });
    }
    next();
};

// Get all colleges for admin (potentially with more details or without pagination)
router.get("/colleges", requireAdmin, async (req, res) => {
    try {
        const colleges = await getColleges();
        res.json(colleges);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create or Update College
router.post("/colleges", requireAdmin, async (req, res) => {
    try {
        const collegeData = req.body;
        if (!collegeData.name) {
            return res.status(400).json({ error: "College name is required" });
        }
        const saved = await saveCollege(collegeData);
        res.json(saved);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete College
router.delete("/colleges/:id", requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await deleteCollege(id);
        res.json({ success: true, id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Invalidate/Refresh Cache
router.post("/cache/invalidate", requireAdmin, async (req, res) => {
    try {
        await invalidateCache();
        res.json({ success: true, message: "Cache invalidated and reloaded from disk" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
