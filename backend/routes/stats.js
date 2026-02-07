const express = require("express");
const { getColleges, getExams } = require("../services/dataStore");
const cache = require("../services/cache");
const _ = require("lodash");

const router = express.Router();

router.get("/aggregate", async (req, res) => {
    const key = "stats:aggregate";
    const cached = await cache.get(key);
    if (cached) return res.json(cached);

    const colleges = await getColleges();
    const exams = await getExams();

    // 1. Colleges by State
    const stateDistribution = _.chain(colleges)
        .groupBy("state")
        .map((items, state) => ({
            name: state || "Unknown",
            count: items.length
        }))
        .orderBy(["count"], ["desc"])
        .value();

    // 2. Colleges by District (Top 10)
    const districtDistribution = _.chain(colleges)
        .groupBy(c => c.meta?.district || c.district)
        .map((items, district) => ({
            name: district || "Unknown",
            count: items.length
        }))
        .orderBy(["count"], ["desc"])
        .take(10)
        .value();

    // 3. Exam Popularity (Accepting Colleges)
    const examPopularity = exams.map(exam => {
        const acceptedCount = (exam.collegesAccepting?.length || 0) + (exam.acceptedColleges?.length || 0);
        return {
            name: exam.shortName || exam.name,
            count: acceptedCount
        };
    }).sort((a, b) => b.count - a.count).slice(0, 10);

    const stats = {
        totalColleges: colleges.length,
        totalExams: exams.length,
        stateDistribution,
        districtDistribution,
        examPopularity
    };

    await cache.set(key, stats, 3600); // Cache for 1 hour
    res.json(stats);
});

module.exports = router;
