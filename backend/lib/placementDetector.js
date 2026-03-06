/**
 * lib/placementDetector.js — CEI Placement Reality Engine (Phase XVI)
 * ====================================================================
 * 4-layer statistical detection of fake/inflated placement claims.
 * All functions are pure (given data) — no internal DB calls.
 * The router/cron fetches the data and passes it in.
 *
 * Usage:
 *   const pd = require('./placementDetector');
 *   const result = pd.runAllLayers({ college, peers, auditHistory });
 */

/**
 * LAYER 1 — Statistical Outlier Detection
 * Uses Z-score to detect if a college's avg_package deviates > 3σ from peers.
 *
 * @param {object} college   - { avg_package }
 * @param {Array}  peers     - Array of { avg_package }
 * @returns {{ score: number, zScore: number, flagged: boolean, description: string }}
 */
function detectStatisticalOutlier(college, peers) {
    if (!peers || peers.length < 3) {
        return { score: 70, zScore: null, flagged: false, description: 'Insufficient peer data for Z-score.' };
    }

    const values = peers.map(p => Number(p.avg_package)).filter(v => !isNaN(v) && v > 0);
    if (values.length < 3) {
        return { score: 70, zScore: null, flagged: false, description: 'Insufficient numeric peer data.' };
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    const val = Number(college.avg_package);

    if (std === 0 || isNaN(val)) {
        return { score: 70, zScore: null, flagged: false, description: 'Zero variance in peer data.' };
    }

    const zScore = (val - mean) / std;
    const flagged = Math.abs(zScore) > 3;

    // Score: starts at 100, reduced by how many σ above the mean (positive outlier is suspicious)
    const zImpact = Math.max(0, zScore - 1.5); // z up to 1.5 is OK
    const score = Math.max(0, Math.round(100 - zImpact * 20));

    return {
        score,
        zScore: Math.round(zScore * 100) / 100,
        peerMean: Math.round(mean),
        peerStd: Math.round(std),
        flagged,
        description: flagged
            ? `avg_package is ${zScore.toFixed(1)}σ above peer mean (₹${Math.round(mean)}k). Likely inflated.`
            : `avg_package is within acceptable range (Z = ${zScore.toFixed(2)}).`
    };
}

/**
 * LAYER 2 — Historical Drift Detection
 * Detects sudden YoY growth > 200% in placement or package data.
 *
 * @param {Array} auditHistory - Array of { fieldName, newValue, createdAt } from AuditLog, sorted by date asc
 * @returns {{ score: number, yoyRatio: number|null, flagged: boolean, description: string }}
 */
function detectHistoricalDrift(auditHistory) {
    if (!auditHistory || auditHistory.length < 2) {
        return { score: 80, yoyRatio: null, flagged: false, description: 'Insufficient historical data for drift check.' };
    }

    // Get avg_package entries
    const pkgHistory = auditHistory
        .filter(e => e.fieldName === 'avg_package' && !isNaN(Number(e.newValue)))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (pkgHistory.length < 2) {
        return { score: 80, yoyRatio: null, flagged: false, description: 'Single historical data point, no drift computable.' };
    }

    const prev = Number(pkgHistory[pkgHistory.length - 2].newValue);
    const curr = Number(pkgHistory[pkgHistory.length - 1].newValue);

    if (prev <= 0 || isNaN(prev) || isNaN(curr)) {
        return { score: 80, yoyRatio: null, flagged: false, description: 'Invalid values in history.' };
    }

    const ratio = curr / prev;
    const flagged = ratio > 3.0; // > 200% growth = flagged

    const score = flagged
        ? Math.max(0, Math.round(100 - (ratio - 3.0) * 15))
        : Math.min(100, Math.round(100 - Math.max(0, ratio - 1.5) * 10));

    return {
        score,
        yoyRatio: Math.round(ratio * 100) / 100,
        prevValue: prev,
        currValue: curr,
        flagged,
        description: flagged
            ? `avg_package jumped ${((ratio - 1) * 100).toFixed(0)}% YoY (from ₹${prev}k to ₹${curr}k). Exceeds 200% threshold.`
            : `YoY growth of ${((ratio - 1) * 100).toFixed(0)}% is within normal range.`
    };
}

/**
 * LAYER 3 — Cross-Source Variance Detection
 * Checks if variance across declared sources exceeds 35%.
 *
 * @param {number}  storedValue  - Value stored in CEI
 * @param {Array}   externalValues - Array of numbers from NIRF/AISHE/etc.
 * @returns {{ score: number, variancePct: number|null, flagged: boolean, description: string }}
 */
function detectCrossSourceVariance(storedValue, externalValues) {
    const vals = [storedValue, ...externalValues].map(Number).filter(v => !isNaN(v) && v > 0);

    if (vals.length < 2) {
        return { score: 75, variancePct: null, flagged: false, description: 'Insufficient external sources for cross-check.' };
    }

    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const maxVal = Math.max(...vals);
    const minVal = Math.min(...vals);
    const variancePct = mean > 0 ? ((maxVal - minVal) / mean) * 100 : 0;
    const flagged = variancePct > 35;

    const score = Math.max(0, Math.round(100 - variancePct));

    return {
        score: Math.min(100, score),
        variancePct: Math.round(variancePct * 10) / 10,
        mean: Math.round(mean),
        flagged,
        description: flagged
            ? `Cross-source variance is ${variancePct.toFixed(1)}%. Expected < 35%. Data sources disagree.`
            : `Cross-source variance is ${variancePct.toFixed(1)}%. Within threshold.`
    };
}

/**
 * LAYER 4 — Company Reality Check
 * Reduces score if claimed companies have no presence in alumni data.
 *
 * @param {Array<string>} claimedCompanies  - Companies listed by college
 * @param {Array<string>} alumniEmployers   - Companies found in alumni employment data
 * @returns {{ score: number, matchRate: number, flagged: boolean, description: string }}
 */
function detectCompanyReality(claimedCompanies, alumniEmployers) {
    if (!claimedCompanies || claimedCompanies.length === 0) {
        return { score: 60, matchRate: null, flagged: false, description: 'No company claims to validate.' };
    }
    if (!alumniEmployers || alumniEmployers.length === 0) {
        return { score: 65, matchRate: null, flagged: false, description: 'No alumni employer data available for validation.' };
    }

    const alumniSet = new Set(alumniEmployers.map(c => c.toLowerCase().trim()));
    const matchCount = claimedCompanies.filter(c => alumniSet.has(c.toLowerCase().trim())).length;
    const matchRate = matchCount / claimedCompanies.length;
    const flagged = matchRate < 0.3 && claimedCompanies.length > 3; // less than 30% of claims verified

    const score = Math.round(40 + matchRate * 60); // 40 at 0%, 100 at 100%

    return {
        score: Math.min(100, score),
        matchRate: Math.round(matchRate * 100),
        matchCount,
        totalClaimed: claimedCompanies.length,
        flagged,
        description: flagged
            ? `Only ${matchCount}/${claimedCompanies.length} claimed companies appear in alumni data (${(matchRate * 100).toFixed(0)}%).`
            : `${matchCount}/${claimedCompanies.length} claimed companies verified in alumni data.`
    };
}

/**
 * Aggregate all 4 layers into a single PlacementRealityScore.
 * Weights: Layer1=30%, Layer2=25%, Layer3=25%, Layer4=20%
 *
 * @param {{ outlier, drift, crossSource, companyReality }} layers - Layer result objects
 * @returns { placementRealityScore, reliabilityLabel, anomalyFlags }
 */
function computePlacementRealityScore({ outlier, drift, crossSource, companyReality }) {
    const s1 = outlier?.score ?? 70;
    const s2 = drift?.score ?? 80;
    const s3 = crossSource?.score ?? 75;
    const s4 = companyReality?.score ?? 65;

    const composite = Math.round(s1 * 0.30 + s2 * 0.25 + s3 * 0.25 + s4 * 0.20);

    let reliabilityLabel;
    if (composite >= 75) reliabilityLabel = 'Highly Reliable';
    else if (composite >= 50) reliabilityLabel = 'Moderate Confidence';
    else reliabilityLabel = 'Suspicious Data';

    const anomalyFlags = [];
    if (outlier?.flagged) anomalyFlags.push({ layer: 'statistical_outlier', severity: 'high', description: outlier.description, data: { zScore: outlier.zScore } });
    if (drift?.flagged) anomalyFlags.push({ layer: 'historical_drift', severity: 'high', description: drift.description, data: { yoyRatio: drift.yoyRatio } });
    if (crossSource?.flagged) anomalyFlags.push({ layer: 'cross_source', severity: 'medium', description: crossSource.description, data: { variancePct: crossSource.variancePct } });
    if (companyReality?.flagged) anomalyFlags.push({ layer: 'company_reality', severity: 'medium', description: companyReality.description, data: { matchRate: companyReality.matchRate } });

    return {
        placementRealityScore: composite,
        reliabilityLabel,
        anomalyFlags,
        layerScores: { statisticalOutlier: s1, historicalDrift: s2, crossSource: s3, companyReality: s4 },
        peerZScore: outlier?.zScore ?? null,
        yoyGrowthRatio: drift?.yoyRatio ?? null,
        crossSourceVariancePct: crossSource?.variancePct ?? null
    };
}

module.exports = {
    detectStatisticalOutlier,
    detectHistoricalDrift,
    detectCrossSourceVariance,
    detectCompanyReality,
    computePlacementRealityScore
};
