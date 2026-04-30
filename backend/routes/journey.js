const express = require('express');
const router = express.Router();
const journeyEngine = require('../services/journeyEngine');

/**
 * journey.js
 * ==========
 * @route   POST /api/journey
 * @desc    Generate strategic journey advice
 */
router.post('/', async (req, res) => {
    try {
        const { domain, rank, category, quota, state, program, predictionResult } = req.body;

        if (!domain || !rank || !predictionResult) {
            return res.status(400).json({ error: "Missing required journey parameters" });
        }

        const journey = journeyEngine.generateJourney({
            domain,
            rank,
            category,
            quota,
            state,
            program,
            predictionResult
        });

        res.json(journey);
    } catch (err) {
        console.error("[JourneyEngine] Error:", err.message);
        res.status(500).json({ error: "Journey calculation failed" });
    }
});

module.exports = router;
