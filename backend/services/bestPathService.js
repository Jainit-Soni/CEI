/**
 * bestPathService.js
 * =====================
 * Generates prioritized admission strategies based on the journey risk profile.
 * Rule: No generic advice, map to real counseling systems.
 */

function generateBestPaths({ domain, journeyOutput }) {
    const { risk_profile, safe_count, realistic_count } = journeyOutput.current_state;
    const paths = [];

    // --- 1. STRONG STRATEGY ---
    if (risk_profile === "STRONG") {
        paths.push({
            title: "Elite Optimization Strategy",
            priority: 1,
            reasoning: `With ${safe_count} safe options, you can afford to aggressively target elite Realistic institutions.`,
            evidence_refs: ["prediction_band:REALISTIC"],
            action_type: "primary"
        });
        paths.push({
            title: "Primary Safety Locking",
            priority: 2,
            reasoning: "Secure the top-tier Safe options in early counseling rounds.",
            evidence_refs: ["prediction_band:SAFE"],
            action_type: "backup"
        });
    }

    // --- 2. BALANCED STRATEGY ---
    if (risk_profile === "BALANCED") {
        paths.push({
            title: "Balanced Choice Filling",
            priority: 1,
            reasoning: "Distribute choices between upper-Realistic and verified Safe options.",
            evidence_refs: ["prediction_band:REALISTIC", "prediction_band:SAFE"],
            action_type: "primary"
        });
        paths.push({
            title: "Strategic Authority Monitoring",
            priority: 2,
            reasoning: domain === 'engineering' ? "Monitor JoSAA progression and keep CSAB as a high-probability backup." : "Monitor AIQ Round 2 and mop-up trends.",
            evidence_refs: domain === 'engineering' ? ["authority:CSAB"] : ["authority:AIQ"],
            action_type: "backup"
        });
    }

    // --- 3. WEAK STRATEGY ---
    if (risk_profile === "WEAK") {
        paths.push({
            title: "Safety-First Consolidation",
            priority: 1,
            reasoning: "Focus entirely on the remaining Safe options to prevent a zero-admission outcome.",
            evidence_refs: ["prediction_band:SAFE"],
            action_type: "primary"
        });
        paths.push({
            title: "Fallback System Activation",
            priority: 2,
            reasoning: domain === 'engineering' ? "Shift focus toward state-level or private counseling pools." : "Incorporate BDS or Deemed University options.",
            evidence_refs: domain === 'engineering' ? ["quota:State Quota"] : ["program:BDS"],
            action_type: "fallback"
        });
    }

    // --- 4. CRITICAL STRATEGY ---
    if (risk_profile === "CRITICAL") {
        paths.push({
            title: "Aggressive Fallback Search",
            priority: 1,
            reasoning: "Primary filters yield no safe paths. Broaden to State, Management, or Alternative programs immediately.",
            evidence_refs: ["risk_profile:CRITICAL"],
            action_type: "fallback"
        });
        paths.push({
            title: "State Counseling Pivot",
            priority: 2,
            reasoning: "State-level merit lists often provide better probability than central AIQ/JoSAA pools at this rank.",
            evidence_refs: ["quota:State Quota"],
            action_type: "primary"
        });
    }

    // Limit to 5 paths as per rule
    return {
        best_paths: paths.slice(0, 5)
    };
}

module.exports = {
    generateBestPaths
};
