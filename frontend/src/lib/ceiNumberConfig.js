/**
 * CEI Frontend Number Configuration
 * 
 * Central registry for factual constants and methodology weights.
 * This file serves as a bridge for items awaiting full API-driven truth-grade status.
 */

export const CEI_SYSTEM_CONFIG = {
    // [INTERNAL] The current active scoring and audit cycle
    ACTIVE_SCORING_CYCLE: 2026,
    
    // [INTERNAL] Default display year for truth-table availability
    TRUTH_TABLE_YEAR: 2024,
    
    // [METHODOLOGY] Thresholds for anomaly detection severity
    INTEGRITY_SCORE_THRESHOLDS: {
        HIGH: 70,
        MEDIUM: 35
    },

    // [METHODOLOGY] Weights for narrative sentiment calculation
    SENTIMENT_WEIGHTS: {
        QUANTITATIVE: 0.7,
        QUALITATIVE: 0.3
    },

    // [DISPLAY] Tier labels for institutional ranking
    TIER_LABELS: {
        TIER_1: "Tier 1",
        TIER_2: "Tier 2",
        TIER_3: "Tier 3"
    }
};

/**
 * Metadata Notes:
 * - ACTIVE_SCORING_CYCLE: Represents the current CEI indexing season. Display-only.
 * - INTEGRITY_SCORE_THRESHOLDS: Used in Admin/Integrity panels to flag anomalies.
 * - SENTIMENT_WEIGHTS: Internal CEI methodology (70/30) for blended score results.
 */
