/**
 * journeyEngine.js
 * ==================
 * Converts prediction results into deterministic next moves and risk profiles.
 * Rule: No generic advice, no forbidden words.
 */

function generateJourney({ domain, rank, category, quota, state, program, predictionResult }) {
    const { safe, realistic, risky, not_observed } = predictionResult.decisionSignals;
    const safeCount = safe.length;
    const realisticCount = realistic.length;
    const riskyCount = risky.length;
    const extremeCount = not_observed?.length || 0;

    // 1. Determine Risk Profile
    let riskProfile = "CRITICAL";
    let summary = "Historically high risk. No safe or realistic options found under current filters.";

    if (safeCount >= 5) {
        riskProfile = "STRONG";
        summary = "Strong strategic position. Multiple historically safe options detected.";
    } else if (safeCount >= 1 || realisticCount >= 5) {
        riskProfile = "BALANCED";
        summary = "Balanced strategic position. Mix of safe and realistic options found.";
    } else if (realisticCount >= 1 || riskyCount >= 5) {
        riskProfile = "WEAK";
        summary = "Weak strategic position. Relying primarily on realistic or risky outcomes.";
    }

    const nextMoves = [];
    const avoidedPaths = [];
    const evidence = [];

    // 2. Engineering Domain Logic
    if (domain === 'engineering') {
        const authority = predictionResult.decisionSignals.meta?.authority;

        if (authority === "JOSAA" && realisticCount > 0) {
            nextMoves.push({
                action: "Prioritize JoSAA choice filling around realistic options",
                reason: "Your rank falls inside observed JoSAA round-progression windows."
            });
            evidence.push({ type: "prediction_band", value: "REALISTIC", source: "CEI predictor" });
        }

        if (authority === "JOSAA" && safeCount === 0 && riskyCount > 0) {
            nextMoves.push({
                action: "Track CSAB Special Round after JoSAA",
                reason: "Your JoSAA options are mostly risky; CSAB may extend closing ranks."
            });
            evidence.push({ type: "authority", value: "CSAB", source: "CEI predictor" });
        }

        if (quota === "ALL_INDIA" && state && state !== "All") {
            nextMoves.push({
                action: "Compare with state counselling options",
                reason: "All-India options can be stricter than state-level pools."
            });
            evidence.push({ type: "quota", value: "State Quota", source: "CEI predictor" });
        }

        if (riskyCount > (safeCount + realisticCount)) {
            avoidedPaths.push({
                avoided: "Do not anchor the list only around top IIT/NIT branches",
                reason: "Most available matches are outside observed closing boundaries."
            });
        }
    }

    // 3. Medical Domain Logic
    if (domain === 'medical') {
        const programType = predictionResult.decisionSignals.meta?.programType || program;

        if (quota === "All India" && realisticCount > 0) {
            nextMoves.push({
                action: "Prioritize AIQ choices with realistic band first",
                reason: "Your NEET rank falls inside the historical AIQ admission distribution."
            });
            evidence.push({ type: "prediction_band", value: "REALISTIC", source: "CEI predictor" });
        }

        if (safeCount === 0 && realisticCount === 0) {
            nextMoves.push({
                action: "Broaden quota/program filters",
                reason: "No historically safe or realistic options were found under the current filters."
            });
            evidence.push({ type: "program", value: programType, source: "CEI predictor" });
        }

        if (programType === "MBBS" && realisticCount === 0) {
            nextMoves.push({
                action: "Check BDS or Deemed options separately",
                reason: "MBBS options are outside observed realistic ranges under current filters."
            });
            evidence.push({ type: "program", value: "BDS", source: "CEI predictor" });
        }

        if (extremeCount > realisticCount) {
            avoidedPaths.push({
                avoided: "Do not rely only on historically extreme outcomes",
                reason: "These were not observed in the central admission distribution."
            });
        }
    }

    return {
        domain,
        rank,
        current_state: {
            safe_count: safeCount,
            realistic_count: realisticCount,
            risky_count: riskyCount,
            extreme_count: extremeCount,
            risk_profile: riskProfile,
            summary
        },
        next_moves: nextMoves,
        avoided_paths: avoidedPaths,
        evidence
    };
}

module.exports = {
    generateJourney
};
