const express = require('express');
const router = express.Router();
const bestPathService = require('../services/bestPathService');

/**
 * bestPath.js
 * ===========
 * @route   POST /api/best-path
 * @desc    Generate prioritized admission strategies
 */
router.post('/', (req, res) => {
    try {
        const { domain, journeyOutput } = req.body;

        if (!domain || !journeyOutput) {
            return res.status(400).json({ error: "Missing required BPG parameters" });
        }

        const result = bestPathService.generateBestPaths({ domain, journeyOutput });
        res.json(result);
    } catch (err) {
        console.error("[BPG] Error:", err.message);
        res.status(500).json({ error: "Best Path calculation failed" });
    }
});

module.exports = router;
