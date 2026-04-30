const cutoffsData = require("../models/cutoffs.json");
const exposurePolicy = require("./engineeringPredictorExposurePolicy");

/**
 * engineeringPredictorService.js
 * ==============================
 * Standardized service for Engineering admissions.
 */

const categorizeCollege = (userRank, cutoffRank) => {
    if (userRank < cutoffRank * 0.8) return "SAFE";
    if (userRank <= cutoffRank * 1.15) return "REALISTIC";
    if (userRank <= cutoffRank * 1.3) return "RISKY";
    return null;
};

async function predictEngineering({ rank, exam, category }) {
    const userRank = parseInt(rank);
    const examColleges = cutoffsData.filter(c => c.exam === exam);

    const prediction = {
        safe: [],
        realistic: [],
        risky: [],
        meta: { userRank, exam, category, engine: "v1-static-json" }
    };

    examColleges.forEach(college => {
        const band = categorizeCollege(userRank, college.closingRank);
        if (band) {
            const item = {
                id: college.id || `ENG-${college.collegeName.replace(/\s+/g, '-')}`,
                name: college.collegeName,
                state: college.location || "Unknown",
                stats: { 
                    p50: college.closingRank, 
                    count: 1, 
                    years_count: 1 
                },
                confidence: "HIGH", // Static JSON is verified batch 1
                band: band,
                mode: "static_v1",
                stability: "MEDIUM",
                trend: { signal: "insufficient_history", label: "Trend unavailable" },
                reason: {
                    interpretation: `Historically, this college closed at ${college.closingRank} for this category.`
                }
            };

            // Attach exposure policy
            item.exposurePolicy = exposurePolicy.buildExposurePolicy(item);

            if (band === "SAFE") prediction.safe.push(item);
            else if (band === "REALISTIC") prediction.realistic.push(item);
            else if (band === "RISKY") prediction.risky.push(item);
        }
    });

    return {
        domain: "engineering",
        identityConfidence: "HIGH",
        truthStatus: "PARTIAL", // JSON is a subset of the full catalog
        decisionSignals: prediction
    };
}

module.exports = {
    predictEngineering
};
