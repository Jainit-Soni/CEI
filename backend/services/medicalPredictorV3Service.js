const mongoose = require('mongoose');
const MedicalCutoff = require('../models/MedicalCutoffSchema');
const dataStore = require('./dataStore');
const predictorExposurePolicy = require('./predictorExposurePolicy');
const logger = require('../lib/logger');

/**
 * medicalPredictorV3Service.js (v3.1 - Production Hardened)
 * ========================================================
 * Statistically grounded decision engine with fallback safety.
 */

function percentile(arr, p) {
    if (arr.length === 0) return 0;
    const idx = Math.max(0, Math.min(arr.length - 1, Math.floor((p / 100) * arr.length)));
    return arr[idx];
}

async function predictMedicalV3({ rank, quota, category, state, programType = 'MBBS' }) {
    try {
        // Sanitize rank (handle commas, spaces)
        const sanitizedRank = rank.toString().replace(/,/g, '').trim();
        const userRank = parseInt(sanitizedRank);
        if (isNaN(userRank)) throw new Error("Invalid rank");

        // Normalize inputs
        let normQuota = (quota || "").trim();
        if (normQuota === "AIQ") normQuota = "All India";
        
        let normCategory = (category || "").trim();
        if (normCategory === "General") normCategory = "OPEN";

        // 1. Aggregation Pipeline
        const stats = await MedicalCutoff.collection.aggregate([
            {
                $match: {
                    program_type: programType,
                    quota: normQuota,
                    category: normCategory
                }
            },
            {
                $group: {
                    _id: {
                        eid: "$medical_entity_id",
                        year: "$year"
                    },
                    ranks: { $push: "$closing_rank" },
                    confidence: { $min: "$hydration_confidence" }
                }
            },
            { $sort: { "_id.year": -1 } },
            {
                $group: {
                    _id: "$_id.eid",
                    yearlyData: {
                        $push: {
                            year: "$_id.year",
                            ranks: "$ranks",
                            confidence: "$confidence"
                        }
                    }
                }
            }
        ]).toArray();

        const prediction = {
            safe: [],
            realistic: [],
            risky: [],
            not_observed: [],
            meta: { userRank, quota, category, state, engine: "v3-statistical-trended" }
        };

        for (const node of stats) {
            const cid = node._id;
            const collegeInfo = await dataStore.getCollegeById(cid);
            
            // CRITICAL IDENTITY GATE: Skip results that cannot be bound to a verified identity
            if (!collegeInfo || !collegeInfo.name) {
                logger.warn(`[PredictorV3] Dropping unbound medical entity: ${cid}`);
                continue;
            }

            if (state && state !== 'All' && collegeInfo.state !== state) continue;

            // Trend Logic (v3.2)
            const history = node.yearlyData;
            const latest = history[0];
            const sorted = latest.ranks.sort((a, b) => a - b);
            const count = sorted.length;
            
            let trend = { signal: "insufficient_history", label: "Trend unavailable — not enough verified years", usable: false };
            if (history.length >= 3) {
                const prev = history[1];
                const latestMedian = sorted[Math.floor(sorted.length / 2)];
                const prevSorted = prev.ranks.sort((a, b) => a - b);
                const prevMedian = prevSorted[Math.floor(prevSorted.length / 2)];
                const delta = latestMedian - prevMedian;
                const percentChange = (delta / prevMedian) * 100;
                
                if (Math.abs(percentChange) < 2) trend = { signal: "stable", label: "Stable", usable: true, percentChange };
                else if (delta < 0) trend = { signal: "tightening", label: "Harder", usable: true, percentChange };
                else trend = { signal: "loosening", label: "Easier", usable: true, percentChange };
            }

            let mode = "statistical_v3";
            let stability = "HIGH";
            let warning = null;

            const p25 = percentile(sorted, 25);
            const p50 = percentile(sorted, 50);
            const p75 = percentile(sorted, 75);
            const p90 = percentile(sorted, 90);
            const spread = p75 - p25;

            // Rule 1: Sample Size Check
            if (count < 5) mode = "fallback_v2";
            
            // Rule 2: Monotonicity Check
            if (!(p25 <= p50 && p50 <= p75 && p75 <= p90)) mode = "fallback_v2";

            // Rule 3: Stability Check
            if (spread > 10000) {
                stability = "LOW";
                warning = "Historical cutoffs for this category are volatile.";
            } else if (spread > 2500) {
                stability = "MEDIUM";
            }

            let band;
            let interpretation;

            // Terminology Rule: Historically based, no guarantees
            if (userRank < p25) {
                band = "SAFE";
                interpretation = "Historically safer. Your rank is well within the typical admission distribution.";
            } else if (userRank <= p75) {
                band = "REALISTIC";
                interpretation = "Historically realistic. You are in the core range where most admissions occur.";
            } else if (userRank <= p90) {
                band = "RISKY";
                interpretation = "Historically risky. Requires favorable round progression or higher vacancy.";
            } else {
                band = "NOT_OBSERVED";
                interpretation = "Not observed in available historical data for this rank range.";
            }

            const item = {
                id: cid,
                name: collegeInfo.name,
                institution_name: collegeInfo.name,
                parent_core_id: collegeInfo.parent_core_id || null,
                state: collegeInfo.state,
                program_type: programType,
                stats: { p25, p50, p75, p90, count, spread, years_count: history.length },
                confidence: latest.confidence,
                band,
                mode,
                stability,
                trend,
                warning,
                reason: { p25, p50, p75, p90, interpretation },
                earliestRound: 1,
                latestRound: 4
            };

            item.exposurePolicy = predictorExposurePolicy.buildExposurePolicy(item);

            if (band === "SAFE") prediction.safe.push(item);
            else if (band === "REALISTIC") prediction.realistic.push(item);
            else if (band === "RISKY") prediction.risky.push(item);
            else prediction.not_observed.push(item);
        }

        const sortByMedian = (a, b) => a.stats.p50 - b.stats.p50;
        prediction.safe.sort(sortByMedian);
        prediction.realistic.sort(sortByMedian);
        prediction.risky.sort(sortByMedian);

        const totalResults = prediction.safe.length + prediction.realistic.length + prediction.risky.length;

        const finalResult = {
            domain: "medical",
            engineVersion: "v3.2-statistical",
            identityConfidence: "HIGH",
            truthStatus: totalResults > 0 ? "FULL" : "IDENTITY_UNAVAILABLE",
            decisionSignals: prediction
        };

        return finalResult;
    } catch (err) {
        logger.error("[PredictorV3] Fatal Error", { message: err.message, stack: err.stack });
        throw err;
    }
}

module.exports = {
    predictMedicalV3
};
