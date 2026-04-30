const MedicalCutoff = require('../models/MedicalCutoffSchema');
const dataStore = require('./dataStore');

/**
 * medicalPredictorService.js (v2 - Trust & Depth Edition)
 * =======================================================
 * Production-grade decision engine for medical admissions.
 * Features: Round-boundary analysis, Explainability, Confidence-weighting.
 */

async function predictColleges({ rank, quota, category, state, programType = 'MBBS' }) {
    try {
        const userRank = parseInt(rank);
        if (isNaN(userRank)) throw new Error("Invalid rank provided");

        // 1. Build Query Filter
        const query = {
            program_type: programType,
            quota: quota,
            category: category
        };
        
        // State-based filtering (Precision routing)
        // Note: For AIQ, state filter might be used to prefer certain regions
        if (state && state !== 'All') {
            // We'll need state metadata on the cutoff documents or join with college index
            // For now, we'll fetch all and filter in memory since we need to cross-ref with dataStore
        }

        // 2. Fetch Relevant Cutoffs (Aggregated by Entity)
        const rawResults = await MedicalCutoff.find(query).lean();

        if (rawResults.length === 0) return { safe: [], realistic: [], risky: [], meta: { userRank } };

        // 3. Group by Entity and Calculate Round Boundaries
        const entityBoundaries = new Map();

        rawResults.forEach(row => {
            const cid = row.medical_entity_id;
            if (!entityBoundaries.has(cid)) {
                entityBoundaries.set(cid, {
                    items: [],
                    minRank: Infinity,
                    maxRank: -Infinity,
                    latestYear: 0,
                    confidence: row.hydration_confidence
                });
            }
            const b = entityBoundaries.get(cid);
            b.items.push(row);
            if (row.closing_rank < b.minRank) b.minRank = row.closing_rank;
            if (row.closing_rank > b.maxRank) b.maxRank = row.closing_rank;
            if (row.year > b.latestYear) b.latestYear = row.year;
            // Downgrade confidence if any source is recovery
            if (row.hydration_confidence === 'RECOVERY') b.confidence = 'RECOVERY';
        });

        const prediction = {
            safe: [],
            realistic: [],
            risky: [],
            meta: { userRank, quota, category, state }
        };

        for (const [cid, b] of entityBoundaries.entries()) {
            const collegeInfo = dataStore.getCollegeById(cid) || { name: "Unknown Institute", state: "Unknown" };
            
            // Optional State Filter
            if (state && state !== 'All' && collegeInfo.state !== state) continue;

            const item = {
                id: cid,
                name: collegeInfo.name,
                state: collegeInfo.state,
                minRank: b.minRank,
                maxRank: b.maxRank,
                confidence: b.confidence,
                reason: "",
                status: ""
            };

            // V2 DECISION LOGIC: Round-Aware Banding
            if (userRank < b.minRank * 0.95) {
                item.status = "SAFE";
                item.reason = `Historically safe. Your rank (${userRank.toLocaleString()}) is below the earliest round cutoff (${b.minRank.toLocaleString()}).`;
                prediction.safe.push(item);
            } else if (userRank >= b.minRank * 0.95 && userRank <= b.maxRank * 1.05) {
                item.status = "REALISTIC";
                item.reason = `Borderline / Realistic. Historically closed between ${b.minRank.toLocaleString()} (Round 1) and ${b.maxRank.toLocaleString()} (Late Rounds). Admission depends on round progression.`;
                prediction.realistic.push(item);
            } else if (userRank > b.maxRank && userRank <= b.maxRank * 1.3) {
                item.status = "RISKY";
                item.reason = `Risky / Reach. Historically closed at ${b.maxRank.toLocaleString()}. Requires significant cutoff expansion in 2026.`;
                prediction.risky.push(item);
            }
        }

        // Sort by rank proximity
        const sortByRank = (a, b) => a.minRank - b.minRank;
        prediction.safe.sort(sortByRank);
        prediction.realistic.sort(sortByRank);
        prediction.risky.sort(sortByRank);

        return prediction;

    } catch (err) {
        console.error("[MedicalPredictor v2] Error:", err.message);
        throw err;
    }
}

module.exports = {
    predictColleges
};
