const mongoose = require('mongoose');

/**
 * medicalTrendService.js
 * =======================
 * Analyzes multi-year cutoff distributions to detect admission volatility.
 * 
 * Logic:
 * tightening = latest_median < previous_median (ranks are lower, harder to get in)
 * loosening  = latest_median > previous_median (ranks are higher, easier to get in)
 * stable     = shift < 2% of median
 */

function calculateMedian(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function getEntityTrend({ entityId, quota, category }) {
    try {
        const history = await mongoose.connection.db.collection('medicalcutoffs').aggregate([
            {
                $match: {
                    medical_entity_id: entityId,
                    quota: quota,
                    category: category
                }
            },
            {
                $group: {
                    _id: "$year",
                    ranks: { $push: "$closing_rank" }
                }
            },
            { $sort: { _id: -1 } } // Sort by year descending
        ]).toArray();

        if (history.length < 2) {
            return {
                signal: "insufficient_history",
                label: "Trend unavailable — only one year verified",
                delta: 0
            };
        }

        const latestYear = history[0];
        const previousYear = history[1];

        const latestMedian = calculateMedian(latestYear.ranks);
        const previousMedian = calculateMedian(previousYear.ranks);

        const delta = latestMedian - previousMedian;
        const percentChange = (delta / previousMedian) * 100;

        let signal;
        let label;

        if (Math.abs(percentChange) < 2) {
            signal = "stable";
            label = "Stable cutoffs";
        } else if (delta < 0) {
            signal = "tightening";
            label = "Cutoffs tightening (Harder)";
        } else {
            signal = "loosening";
            label = "Cutoffs loosening (Easier)";
        }

        return {
            signal,
            label,
            delta,
            percentChange: percentChange.toFixed(2),
            years: [latestYear._id, previousYear._id]
        };

    } catch (err) {
        console.error("[MedicalTrendService] Error:", err.message);
        return { signal: "error", label: "Analysis error" };
    }
}

module.exports = {
    getEntityTrend
};
