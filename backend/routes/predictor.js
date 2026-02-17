const express = require("express");
const router = express.Router();
const cutoffsData = require("../models/cutoffs.json");

// Helper: Calculate Zone
const categorizeCollege = (userRank, cutoffRank) => {
    // Basic logic for MVP
    // Safe: Cutoff is significantly higher than user rank (more seats available above user)
    if (cutoffRank > userRank * 1.2) return "safe";

    // Target: Cutoff is close to user rank (+/- 10-20%)
    const diff = Math.abs(cutoffRank - userRank);
    const percentDiff = (diff / userRank) * 100;
    if (percentDiff <= 20) return "target";

    // Dream: Cutoff is lower than user rank (hard to get)
    return "dream";
};

// @route   POST /api/predict
// @desc    Predict admission chances
// @access  Public
router.post("/", (req, res) => {
    try {
        const { rank, exam, category } = req.body;

        if (!rank || !exam) {
            return res.status(400).json({ error: "Rank and Exam are required" });
        }

        const userRank = parseInt(rank);

        // 1. Filter by Exam
        const examColleges = cutoffsData.filter(c => c.exam === exam);

        // 2. Buckets
        const results = {
            safe: [],
            target: [],
            dream: []
        };

        examColleges.forEach(college => {
            const zone = categorizeCollege(userRank, college.closingRank);
            results[zone].push({
                ...college,
                zone: zone,
                probability: zone === 'safe' ? '90%+' : zone === 'target' ? '50-70%' : '<20%'
            });
        });

        res.json(results);

    } catch (err) {
        console.error("Predictor Error:", err);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
