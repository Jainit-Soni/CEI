const mongoose = require('mongoose');
const exposurePolicy = require('./engineeringPredictorExposurePolicy');
const dataStore = require('./dataStore');

/**
 * engineeringPredictorV2Service.js
 * =================================
 * Round-aware boundary predictor for Engineering.
 */

async function predictEngineeringV2({ rank, category, quota, genderPool, program, authority = "JOSAA" }) {
    try {
        // Sanitize rank
        const sanitizedRank = rank.toString().replace(/,/g, '').trim();
        const userRank = parseInt(sanitizedRank);
        if (isNaN(userRank)) throw new Error("Invalid rank");

        // Normalize inputs
        const normCategory = (category || "").toUpperCase();
        let normQuota = (quota || "").toUpperCase();
        if (normQuota === "AI") normQuota = "ALL_INDIA";
        if (normQuota === "OS") normQuota = "OTHER_STATE";
        if (normQuota === "HS") normQuota = "HOME_STATE";

        let normGender = (genderPool || "").toUpperCase().replace(/-/g, '_');
        if (normGender === "GENDER_NEUTRAL") normGender = "GENDER_NEUTRAL"; // Already correct

        const matchStage = {
            canonical_category_label: normCategory,
            quota_canonical: normQuota,
            gender_pool_canonical: normGender,
            closing_rank: { $ne: null }
        };

        if (program) {
            matchStage.program_title = program;
        }

        if (authority !== "ALL") {
            matchStage.source_authority = authority;
        }

        const stats = await mongoose.connection.db.collection('engineering_cutoffs').aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        iid: "$institution_id",
                        name: "$institute_name_normalized",
                        prog: "$program_title",
                        q: "$quota_canonical",
                        cat: "$canonical_category_label",
                        gen: "$gender_pool_canonical"
                    },
                    rounds: {
                        $push: {
                            round: "$round_number",
                            closing: "$closing_rank",
                            authority: "$source_authority"
                        }
                    },
                    totalPoints: { $sum: 1 }
                }
            }
        ]).toArray();

        const prediction = {
            safe: [],
            realistic: [],
            risky: [],
            meta: {
                rank: userRank,
                category,
                quota,
                genderPool,
                program,
                authority,
                generatedAt: new Date().toISOString()
            }
        };

        stats.forEach(node => {
            const sortedRounds = node.rounds.sort((a, b) => a.round - b.round);
            const earliestRound = sortedRounds[0];
            const latestRound = sortedRounds[sortedRounds.length - 1];
            
            const strictBoundary = earliestRound.closing;
            const looseBoundary = Math.max(...node.rounds.map(r => r.closing));
            const roundCount = new Set(node.rounds.map(r => r.round)).size;
            const dataPoints = node.totalPoints;

            let band;
            let reason;

            if (userRank < strictBoundary) {
                band = "SAFE";
                reason = `Historically safer. Your rank is below the earliest-round closing rank of ${strictBoundary.toLocaleString()}.`;
            } else if (userRank <= looseBoundary) {
                band = "REALISTIC";
                reason = `Historically realistic. Your rank falls inside the observed round progression window: ${strictBoundary.toLocaleString()} in Round ${earliestRound.round} to ${looseBoundary.toLocaleString()} by Round ${latestRound.round}.`;
            } else {
                band = "RISKY";
                reason = `Historically risky. Your rank is beyond the loosest observed closing rank of ${looseBoundary.toLocaleString()}.`;
            }

            // Confidence Logic
            let confidence = "LOW";
            const authorities = new Set(node.rounds.map(r => r.authority));
            const hasOfficialAuth = authorities.has("JOSAA") || authorities.has("CSAB");

            if (roundCount >= 3 && dataPoints >= 3 && hasOfficialAuth) {
                confidence = "HIGH";
            } else if (roundCount >= 2) {
                confidence = "MEDIUM";
            }

            const item = {
                institution_id: node._id.iid,
                institute_name: node._id.name,
                program_title: node._id.prog,
                quota: node._id.q,
                category: node._id.cat,
                genderPool: node._id.gen,
                strictBoundary,
                looseBoundary,
                earliestRound: earliestRound.round,
                latestRound: latestRound.round,
                roundCount,
                band,
                confidence,
                reason,
                stats: {
                    count: dataPoints,
                    years_count: 1 // Current dataset is 2025 single year
                }
            };

            // Attach exposure policy
            item.exposurePolicy = exposurePolicy.buildExposurePolicy(item);

            if (band === "SAFE") prediction.safe.push(item);
            else if (band === "REALISTIC") prediction.realistic.push(item);
            else if (band === "RISKY") prediction.risky.push(item);
        });

        // Sorting by strictBoundary (quality first)
        const sortByRank = (a, b) => a.strictBoundary - b.strictBoundary;
        prediction.safe.sort(sortByRank);
        prediction.realistic.sort(sortByRank);
        prediction.risky.sort(sortByRank);

        // Adaptive Ranking Patch
        if (process.env.ADAPTIVE_RANKING === "true") {
            const adaptiveRankingService = require('./adaptiveRankingService');
            const insights = adaptiveRankingService.loadInsights();
            adaptiveRankingService.applyAdaptiveRanking(prediction, {
                domain: "engineering",
                rank: userRank,
                insights
            });
        }

        return {
            domain: "engineering",
            engineVersion: "v2-boundary",
            identityConfidence: "HIGH",
            truthStatus: "FULL",
            decisionSignals: prediction
        };

    } catch (err) {
        console.error("[EngineeringPredictorV2] Error:", err.message);
        throw err;
    }
}

module.exports = {
    predictEngineeringV2
};
