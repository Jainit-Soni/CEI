const express = require("express");
const router = express.Router();
const cutoffsData = require("../models/cutoffs.json");

// Helper: Calculate Zone
const categorizeCollege = (userRank, cutoffRank) => {
    // Stricter logic
    // Safe: User rank is significantly better (lower) than cutoff
    // e.g. Rank 500, Cutoff 1000 -> Safe
    if (userRank < cutoffRank * 0.8) return "safe";

    // Target: User rank is close to cutoff (+/- 10%)
    // e.g. Rank 1050, Cutoff 1000 -> Margin is 50. 50/1000 = 5%. -> Target
    if (userRank <= cutoffRank * 1.15) return "target";

    // Dream: User rank is worse than cutoff (up to 30% margin)
    // e.g. Rank 1250, Cutoff 1000 -> Dream
    if (userRank <= cutoffRank * 1.3) return "dream";

    return null; // No chance
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

        // Helper to convert percentile to rank (approx for JEE Main ~12 Lakh candidates)
        let processedRank = userRank;
        if (rank <= 100 && rank > 0) {
            // Likely a percentile if <= 100 (though rank can be <= 100 too, simplistic check)
            // If user explicitly sent 'percentile' type in real app we'd know. 
            // Here we assume if < 100 and labeled "Percentile" in UI it comes as rank=70
            // But the API receives 'rank'. Let's assume input forms send raw number.
            // We'll stick to the plan: In the UI we might handle conversion or here.
            // Let's assume the UI sends "rank" field effectively.
        }

        // 1. Filter by Exam
        const examColleges = cutoffsData.filter(c => c.exam === exam);

        // 2. Buckets
        const results = {
            safe: [],
            target: [],
            dream: []
        };

        examColleges.forEach(college => {
            const zone = categorizeCollege(processedRank, college.closingRank);
            if (zone) {
                results[zone].push({
                    ...college,
                    zone: zone,
                    probability: zone === 'safe' ? '90%+' : zone === 'target' ? '50-60%' : '<20%'
                });
            }
        });

        res.json(results);

    } catch (err) {
        console.error("Predictor Error:", err);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
