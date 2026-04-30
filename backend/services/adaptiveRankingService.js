const fs = require('fs');
const path = require('path');

function loadInsights() {
    try {
        const p = path.join(__dirname, '../reports/predictor_insights.json');
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf8'));
        }
    } catch (e) {
        console.warn("[AdaptiveRanking] Could not load insights:", e.message);
    }
    return null;
}

function applyAdaptiveRanking(prediction, context) {
    const { domain, rank, insights } = context;
    const userRank = parseInt(rank);
    const highestCtrBand = insights?.behavior?.highest_ctr_band || "SAFE";

    const scoreItem = (item) => {
        let score = 0;
        
        // 1. Base Score by Band
        const bandScores = {
            "SAFE": 300,
            "REALISTIC": 250,
            "RISKY": 150,
            "EXTREME": 50,
            "NOT_OBSERVED": 10
        };
        score = bandScores[item.band] || 100;

        // 2. Telemetry Adjustment (CTR Boost)
        if (item.band === highestCtrBand) {
            score += 25;
        }

        // 3. Confidence Adjustment
        if (item.confidence === 'HIGH') score += 20;
        if (item.confidence === 'LOW') score -= 20;

        // 4. Contextual Rank Adjustment
        if (userRank > 30000 && item.band === "SAFE") {
            score += 15; // Prioritize safety for high ranks
        }
        if (userRank < 5000 && item.band === "REALISTIC") {
            score += 10; // Allow competitive/elite realistic options to surface
        }

        return score;
    };

    // We process each bucket separately to ensure band separation is maintained 
    // OR we could merge and sort if the UI supports a unified list.
    // The requirement says "reorder inside the final display list".
    // We will apply sorting to each bucket but also provide a unified "rankedResults"
    
    const buckets = ["safe", "realistic", "risky", "not_observed"];
    buckets.forEach(bucket => {
        if (prediction[bucket]) {
            prediction[bucket].sort((a, b) => scoreItem(b) - scoreItem(a));
        }
    });

    return prediction;
}

module.exports = {
    applyAdaptiveRanking,
    loadInsights
};
