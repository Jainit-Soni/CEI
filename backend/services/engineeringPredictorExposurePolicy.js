/**
 * engineeringPredictorExposurePolicy.js
 * =====================================
 * Standardizes exposure rules for Engineering outcomes.
 */

function buildExposurePolicy(item) {
    // For engineering v1 (JSON based), we usually have 1 sample/year in the flat file.
    // If we migrate to MongoDB v3 for engineering, this will light up naturally.
    const count = item.stats ? item.stats.count : 1;
    const yearsCount = item.stats ? item.stats.years_count : 1;
    
    const policy = {
        level: "LOW_DATA",
        label: "Limited historical data — showing conservative estimate",
        show: {
            band: true,
            reason: true,
            confidence: true,
            percentiles: false,
            stability: false,
            trend: false
        },
        warning: null
    };

    // Promotion logic
    if (count >= 5 && yearsCount >= 3) {
        policy.level = "HIGH_DATA";
        policy.label = "Full statistical signal available";
        policy.show.percentiles = true;
        policy.show.stability = true;
        policy.show.trend = true;
    } else if (count >= 5) {
        policy.level = "MEDIUM_DATA";
        policy.label = "Trend unavailable — not enough verified years";
        policy.show.percentiles = true;
        policy.show.stability = true;
        policy.show.trend = false;
    }

    return policy;
}

module.exports = {
    buildExposurePolicy
};
