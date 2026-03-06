/**
 * lib/confidenceEngine.js — CEI National Data Verification Engine (Phase XVI)
 * ============================================================================
 * Pure, side-effect-free confidence computation.
 * No DB calls — just math.
 *
 * Usage:
 *   const { computeConfidence, deriveStatus } = require('./confidenceEngine');
 *   const score = computeConfidence({ sources, consistency, recency, stability });
 *   const label = deriveStatus(score);
 */

const TRUST_LEVEL_WEIGHTS = { HIGH: 1.0, MEDIUM: 0.65, LOW: 0.3 };

/**
 * Compute a 0–100 confidence score for a verified field.
 *
 * @param {object} params
 * @param {Array}  params.sources             - Array of active SourceEvidence objects
 * @param {number} params.consistency         - 0–1. Fraction of sources agree on the same value
 * @param {number} params.recency             - 0–1. 1.0 = captured within 30 days, decays by age
 * @param {number} params.historicalStability - 0–1. 1.0 = value unchanged across last 3 records
 * @returns {number} Confidence score 0–100 (rounded to 1 decimal)
 */
function computeConfidence({ sources = [], consistency = 1.0, recency = 0.5, historicalStability = 0.5 }) {
    // ── Factor 1: Source Count (30%) ────────────────────────────────────────────
    // Caps at 5 sources (100%), logarithmic scaling
    const sourceCountFactor = sources.length === 0
        ? 0
        : Math.min(1.0, Math.log(sources.length + 1) / Math.log(6));

    // ── Factor 2: Trust Level Average (30%) ────────────────────────────────────
    const trustFactor = sources.length === 0
        ? 0
        : sources.reduce((sum, s) => sum + (TRUST_LEVEL_WEIGHTS[s.trustLevel] || 0.3), 0) / sources.length;

    // ── Factor 3: Data Consistency (20%) ───────────────────────────────────────
    const consistencyFactor = Math.max(0, Math.min(1, consistency));

    // ── Factor 4: Recency (10%) ─────────────────────────────────────────────────
    const recencyFactor = Math.max(0, Math.min(1, recency));

    // ── Factor 5: Historical Stability (10%) ───────────────────────────────────
    const stabilityFactor = Math.max(0, Math.min(1, historicalStability));

    const raw = (sourceCountFactor * 0.30)
        + (trustFactor * 0.30)
        + (consistencyFactor * 0.20)
        + (recencyFactor * 0.10)
        + (stabilityFactor * 0.10);

    return Math.round(raw * 100 * 10) / 10; // 0–100, 1 decimal place
}

/**
 * Compute a 0–1 recency score from a capturedAt date.
 * 100% at 0 days, decays to 0 at 2 years.
 *
 * @param {Date|string} capturedAt
 * @returns {number} 0–1
 */
function computeRecency(capturedAt) {
    if (!capturedAt) return 0;
    const ageMs = Date.now() - new Date(capturedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const twoYears = 730;
    return Math.max(0, 1 - ageDays / twoYears);
}

/**
 * Compute consistency: what fraction of sources agree on a normalizedValue?
 * @param {Array} sources - Array of SourceEvidence (with normalizedValue)
 * @returns {number} 0–1
 */
function computeConsistency(sources) {
    if (sources.length === 0) return 1.0;
    if (sources.length === 1) return 0.8; // single source = partial confidence

    const values = sources.map(s => JSON.stringify(s.normalizedValue ?? s.rawValue));
    const freq = {};
    values.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
    const maxFreq = Math.max(...Object.values(freq));

    return maxFreq / sources.length;
}

/**
 * Derive a human-readable status label from a confidence score.
 * @param {number} score - 0–100
 * @returns {string}
 */
function deriveStatus(score) {
    if (score >= 90) return 'Verified';
    if (score >= 70) return 'Likely Accurate';
    if (score >= 40) return 'Needs Review';
    return 'Untrusted';
}

module.exports = { computeConfidence, computeRecency, computeConsistency, deriveStatus, TRUST_LEVEL_WEIGHTS };
