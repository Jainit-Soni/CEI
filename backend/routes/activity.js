const express = require("express");
const router = express.Router();
const ActivityLog = require("../models/ActivityLog");
const College = require("../models/College");

// @route   POST /api/activity/ping
// @desc    Log a view for a college
// @access  Public
router.post("/ping", async (req, res) => {
    try {
        const { collegeId } = req.body;
        if (!collegeId) {
            return res.status(400).json({ error: "College ID is required" });
        }

        // Create a new activity log
        // We don't need to await this if we want fire-and-forget for speed,
        // but waiting ensures data integrity for the "pulse" feeling.
        await ActivityLog.create({ collegeId });

        res.status(200).json({ success: true });
    } catch (err) {
        console.error("Activity logging error:", err);
        // Don't crash the client if logging fails
        res.status(200).json({ success: false });
    }
});

// @route   GET /api/activity/stats
// @desc    Get top active colleges and specific college count
// @access  Public
router.get("/stats", async (req, res) => {
    try {
        const { collegeId } = req.query;

        // 1. Get count for specific college if requested
        let currentViewers = 0;
        if (collegeId) {
            // Count documents in last 15 minutes (handled by TTL usage or explicit query)
            // Since TTL removes old docs, simple count is enough for "live" feel
            currentViewers = await ActivityLog.countDocuments({ collegeId });
        }

        // 2. Get Top 5 Trending (Optional, for homepage or "Trending" widget)
        // Aggregate by collegeId
        // const trending = await ActivityLog.aggregate([
        //     { $group: { _id: "$collegeId", count: { $sum: 1 } } },
        //     { $sort: { count: -1 } },
        //     { $limit: 5 }
        // ]);

        // For now, just return the specific count to keep it light
        res.json({
            collegeId,
            viewers: currentViewers
        });

    } catch (err) {
        console.error("Activity stats error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

module.exports = router;
