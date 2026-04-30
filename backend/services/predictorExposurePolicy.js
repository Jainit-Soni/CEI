/**
 * predictorExposurePolicy.js
 * ===========================
 * Controls the visibility of statistical signals based on data defensibility.
 * 
 * LOW_DATA:   Hides trend, percentiles, and stability.
 * MEDIUM_DATA: Hides trend only.
 * HIGH_DATA:   Shows all signals.
 */

function buildExposurePolicy(item) {
    const count = item.stats.count;
    const yearsCount = item.stats.years_count || 1; // Fallback to 1 if not provided
    const mode = item.mode;
    const anomaly = item.anomaly_flag || false;

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

    // Hard Rule: Anomaly override
    if (anomaly) {
        policy.warning = "Historical movement is unusually volatile";
    }

    // Double check hard constraints
    if (count < 5) {
        policy.show.percentiles = false;
        policy.show.stability = false;
    }
    if (yearsCount < 3) {
        policy.show.trend = false;
    }

    return policy;
}

module.exports = {
    buildExposurePolicy
};
