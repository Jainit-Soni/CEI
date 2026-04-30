const express = require("express");
const router = express.Router();
const engineeringPredictorService = require("../services/engineeringPredictorService");
const engineeringPredictorV2Service = require("../services/engineeringPredictorV2Service");

/**
 * predictor.js
 * ============
 * @route   POST /api/predict
 * @desc    Predict admission chances (Engineering v1)
 */
router.post("/", async (req, res) => {
    try {
        const { rank, exam, category } = req.body;

        if (!rank || !exam) {
            return res.status(400).json({ error: "Rank and Exam are required" });
        }

        const result = await engineeringPredictorService.predictEngineering({ 
            rank, 
            exam, 
            category 
        });
        
        res.json(result);

    } catch (err) {
        console.error("Predictor Error:", err);
        res.status(500).send("Server Error");
    }
});

/**
 * @route   GET /api/predict/engineering-v2
 * @desc    Advanced round-aware predictor
 */
router.get("/engineering-v2", async (req, res) => {
    try {
        const { rank, category, quota, genderPool, program, authority } = req.query;

        if (!rank || !category || !quota || !genderPool) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const result = await engineeringPredictorV2Service.predictEngineeringV2({
            rank,
            category,
            quota,
            genderPool,
            program,
            authority
        });

        res.json(result);
    } catch (err) {
        console.error("Predictor v2 Error:", err);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
