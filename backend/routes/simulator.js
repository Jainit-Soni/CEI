/**
 * routes/simulator.js — CEI Institutional Improvement Simulator (Phase XIII)
 * ===========================================================================
 * Sandbox-only what-if scoring engine.
 * NEVER modifies the database. Never creates a ScoringVersion.
 * Every response is tagged isHypothetical: true.
 *
 * Endpoints:
 *   POST /api/simulator/what-if          — Score delta for hypothetical changes
 *   GET  /api/simulator/peer-cluster/:id — Peer cluster benchmarking
 */

const express = require('express');
const router = express.Router();
const College = require('../models/CollegeSchema');
const logger = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// ── CEI Scoring Formula Clone (Sandbox) ───────────────────────────────────────
// Mirrors the Python scoring engine logic deterministically.
// Any changes to the scoring engine MUST be reflected here.

const NAAC_SCORES = { 'A++': 4.0, 'A+': 3.6, 'A': 3.2, 'B++': 2.8, 'B+': 2.4, 'B': 2.0, 'C': 1.4, '': 0 };
const TIER_SCORES = { 'Tier 1': 5, 'Tier 2': 4, 'Tier 3': 2, 'University': 4.5, 'Stand Alone': 2.5 };

const WEIGHTS = { A: 0.30, F: 0.20, I: 0.20, S: 0.15, D: 0.10, U: 0.05 };

/**
 * Compute the raw CEI vector scores from a college object (plain JS object, not DB doc).
 * Returns a score in the range ~0–100.
 */
function computeSimulatedScore(c) {
    const estYear = parseInt(c?.meta?.establishedYear || c?.establishedYear) || 2010;
    const age = Math.max(0, 2026 - estYear);

    // A — Accreditation
    const naacScore = NAAC_SCORES[c?.meta?.naacGrade || c?.naacGrade || ''] ?? 0;
    const A = naacScore / 4.0 * 10;

    // F — Faculty legacy (age proxy)
    const F = Math.min(10, age / 10);

    // I — Infrastructure (tier + campus proxy)
    const tierScore = TIER_SCORES[c?.rankingTier] || 2;
    const I = tierScore / 5 * 10;

    // S — Scale
    const courseCount = (c?.courses?.length || 0);
    const S = Math.min(10, courseCount / 5);

    // D — Demand (intake × accreditation proxy)
    const placementRate = parseFloat(c?.placementRate || c?.placements?.placementRate) || 0;
    const D = Math.min(10, (placementRate / 100) * 10 + naacScore * 0.5);

    // U — Urban (constant proxy — not enough geo data in sandbox)
    const U = 5;

    const rawScore =
        WEIGHTS.A * A + WEIGHTS.F * F + WEIGHTS.I * I +
        WEIGHTS.S * S + WEIGHTS.D * D + WEIGHTS.U * U;

    // Scale to 0-100 range (raw is ~0-10)
    return Math.min(100, Math.max(0, +(rawScore * 10).toFixed(2)));
}

// ── POST /api/simulator/what-if ───────────────────────────────────────────────

/**
 * Body:
 * {
 *   collegeId: string,
 *   hypotheticals: {
 *     naacGrade?:      "A" | "A+" | ... ,
 *     placementRate?:  number (0-100),
 *     rankingTier?:    "Tier 1" | "Tier 2" | ...,
 *     courseCount?:    number,
 *     establishedYear?: number
 *   }
 * }
 */
router.post('/what-if', async (req, res) => {
    try {
        const { collegeId, hypotheticals = {} } = req.body;
        if (!collegeId) return res.status(400).json({ error: 'collegeId is required.' });

        const maxKeys = 5;
        if (Object.keys(hypotheticals).length > maxKeys) {
            return res.status(400).json({ error: `Maximum ${maxKeys} hypothetical changes per simulation.` });
        }

        const ALLOWED_FIELDS = ['naacGrade', 'placementRate', 'rankingTier', 'courseCount', 'establishedYear'];
        const badKeys = Object.keys(hypotheticals).filter(k => !ALLOWED_FIELDS.includes(k));
        if (badKeys.length) {
            return res.status(400).json({ error: `Unknown hypothetical fields: ${badKeys.join(', ')}. Allowed: ${ALLOWED_FIELDS.join(', ')}` });
        }

        const college = await College.findOne({ id: collegeId }).lean();
        if (!college) return res.status(404).json({ error: 'Institution not found.' });

        // ── Compute CURRENT score ──────────────────────────────────────────────
        const currentScore = college.ceiScore || computeSimulatedScore(college);

        // ── Build HYPOTHETICAL clone (pure in-memory, never written to DB) ────
        const hypo = JSON.parse(JSON.stringify(college)); // deep clone

        if (hypotheticals.naacGrade !== undefined) {
            if (!hypo.meta) hypo.meta = {};
            hypo.meta.naacGrade = hypotheticals.naacGrade;
        }
        if (hypotheticals.placementRate !== undefined) {
            const pr = parseFloat(hypotheticals.placementRate);
            if (isNaN(pr) || pr < 0 || pr > 100) {
                return res.status(400).json({ error: 'placementRate must be 0–100.' });
            }
            if (!hypo.placements) hypo.placements = {};
            hypo.placements.placementRate = String(pr);
            hypo.placementRate = pr;
        }
        if (hypotheticals.rankingTier !== undefined) {
            hypo.rankingTier = hypotheticals.rankingTier;
        }
        if (hypotheticals.courseCount !== undefined) {
            hypo.courses = new Array(Math.min(50, Math.max(0, parseInt(hypotheticals.courseCount)))).fill({});
        }
        if (hypotheticals.establishedYear !== undefined) {
            if (!hypo.meta) hypo.meta = {};
            hypo.meta.establishedYear = String(hypotheticals.establishedYear);
        }

        // ── Compute SIMULATED score ─────────────────────────────────────────────
        const simulatedScore = computeSimulatedScore(hypo);
        const scoreDelta = +(simulatedScore - currentScore).toFixed(2);

        // Band mapping
        const scoreToBand = (s) => {
            if (s >= 85) return 'Elite';
            if (s >= 70) return 'High';
            if (s >= 55) return 'Competitive';
            if (s >= 40) return 'Moderate';
            return 'Emerging';
        };

        res.json({
            isHypothetical: true,
            disclaimer: 'This is a sandbox simulation. No data has been saved. Results are approximate and use a simplified scoring model for illustration only.',
            collegeId,
            collegeName: college.name,
            currentScore,
            simulatedScore,
            scoreDelta,
            currentBand: scoreToBand(currentScore),
            simulatedBand: scoreToBand(simulatedScore),
            appliedChanges: hypotheticals
        });
    } catch (err) {
        logger.error('[Simulator] what-if error', { error: err.message });
        res.status(500).json({ error: 'Simulation failed.' });
    }
});

// ── GET /api/simulator/peer-cluster/:id ──────────────────────────────────────

/**
 * Returns the peer cluster (same state + rankingTier) for an institution
 * with percentile positioning and CEI vector gap analysis.
 */
router.get('/peer-cluster/:collegeId', async (req, res) => {
    try {
        const college = await College.findOne(
            { id: req.params.collegeId },
            { id: 1, name: 1, state: 1, rankingTier: 1, ceiScore: 1, dataIntegrityScore: 1 }
        ).lean();

        if (!college) return res.status(404).json({ error: 'Institution not found.' });

        // Fetch peer cluster (same state + tier, limit 50, has ceiScore)
        const peers = await College.find(
            {
                state: college.state,
                rankingTier: college.rankingTier,
                ceiScore: { $exists: true, $ne: null },
                id: { $ne: college.id }
            },
            { id: 1, name: 1, shortName: 1, ceiScore: 1, dataIntegrityScore: 1, dataConfidenceLabel: 1 }
        ).sort({ ceiScore: -1 }).limit(50).lean();

        if (peers.length < 2) {
            return res.json({
                collegeId: college.id,
                collegeName: college.name,
                cluster: `${college.state} — ${college.rankingTier}`,
                peers: [],
                percentile: null,
                message: 'Insufficient peer data for meaningful clustering.'
            });
        }

        const allScores = [...peers.map(p => p.ceiScore), college.ceiScore].sort((a, b) => a - b);
        const myRank = allScores.indexOf(college.ceiScore) + 1;
        const percentile = +((myRank / allScores.length) * 100).toFixed(1);
        const clusterAvg = +(allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2);
        const p90Score = allScores[Math.floor(allScores.length * 0.9)];

        const gapToClusterAvg = +(college.ceiScore - clusterAvg).toFixed(2);
        const gapToP90 = +(college.ceiScore - p90Score).toFixed(2);

        res.json({
            collegeId: college.id,
            collegeName: college.name,
            cluster: `${college.state} — ${college.rankingTier}`,
            myScore: college.ceiScore,
            clusterSize: peers.length + 1,
            percentile,
            clusterAvgScore: clusterAvg,
            clusterTop10PctScore: p90Score,
            gapToClusterAvg,
            gapToTop10Pct: gapToP90,
            positionLabel: percentile >= 90 ? 'Top Performer' :
                percentile >= 70 ? 'Above Average' :
                    percentile >= 40 ? 'Average' : 'Below Average',
            peers: peers.slice(0, 10).map(p => ({
                id: p.id,
                name: p.shortName || p.name,
                ceiScore: p.ceiScore,
                dataConfidenceLabel: p.dataConfidenceLabel
            }))
        });
    } catch (err) {
        logger.error('[Simulator] peer-cluster error', { error: err.message });
        res.status(500).json({ error: 'Failed to fetch peer cluster.' });
    }
});

module.exports = router;
