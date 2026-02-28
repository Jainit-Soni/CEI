/**
 * routes/verify.js — CEI Third-Party Verifiability Layer (Phase XV)
 * ==================================================================
 * Enables any external developer to independently verify CEI scores.
 * No authentication required — these are public transparency endpoints.
 *
 * Endpoints:
 *   GET  /api/verify/methodology              — Active formula in machine+human form
 *   GET  /api/verify/institution/:id/manifest — Full input vector for any institution
 *   POST /api/verify/recompute                — Recompute score from raw vectors
 *   GET  /api/verify/record-hash/:id          — Record integrity hash for verification
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const College = require('../models/CollegeSchema');
const ScoringVersion = require('../models/ScoringVersion');
const logger = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// ── Scoring formula (mirrors phase3_score.py) ─────────────────────────────
const NAAC_SCORES = { 'A++': 4.0, 'A+': 3.6, 'A': 3.2, 'B++': 2.8, 'B+': 2.4, 'B': 2.0, 'C': 1.4, '': 0 };
const TIER_SCORES = { 'Tier 1': 5, 'Tier 2': 4, 'Tier 3': 2, 'University': 4.5, 'Stand Alone': 2.5 };

const DEFAULT_WEIGHTS = { A: 0.30, F: 0.20, I: 0.20, S: 0.15, D: 0.10, U: 0.05 };

/**
 * Apply the CEI scoring formula to a 6-vector object.
 * Returns a score in 0–100 range.
 */
function applyFormula(vectors, weights = DEFAULT_WEIGHTS) {
    const { A = 0, F = 0, I = 0, S = 0, D = 0, U = 5 } = vectors;
    const raw = weights.A * A + weights.F * F + weights.I * I +
        weights.S * S + weights.D * D + weights.U * U;
    return Math.min(100, Math.max(0, +(raw * 10).toFixed(4)));
}

/**
 * Extract and normalize the 6 CEI vectors from a college record.
 */
function extractVectors(college) {
    const estYear = parseInt(college?.meta?.establishedYear) || 2010;
    const age = Math.max(0, 2026 - estYear);
    const naac = NAAC_SCORES[college?.meta?.naacGrade || ''] ?? 0;
    const tier = TIER_SCORES[college?.rankingTier] || 2;
    const courses = (college?.courses || []).length;
    const pr = parseFloat(college?.placements?.placementRate) || 0;

    return {
        A: +(naac / 4.0 * 10).toFixed(4),
        F: +(Math.min(10, age / 10)).toFixed(4),
        I: +(tier / 5.0 * 10).toFixed(4),
        S: +(Math.min(10, courses / 5)).toFixed(4),
        D: +(Math.min(10, pr / 10 + naac * 0.5)).toFixed(4),
        U: 5.0000
    };
}

// ── GET /api/verify/methodology ────────────────────────────────────────────

router.get('/methodology', async (req, res) => {
    try {
        const version = await ScoringVersion.findOne({ status: 'active' },
            { versionId: 1, weights: 1, datasetHash: 1, activatedAt: 1 }).lean();

        const weights = (version?.weights && Object.keys(version.weights).length)
            ? version.weights
            : DEFAULT_WEIGHTS;

        res.json({
            scoringVersion: version?.versionId || 'unknown',
            activatedAt: version?.activatedAt || null,
            datasetHash: version?.datasetHash || null,
            formula: {
                description: 'CEI Score = Σ(weight_i × normalized_vector_i) × 10, clamped to [0, 100]',
                vectors: {
                    A: { name: 'Accreditation', weight: weights.A, normalization: 'naacScore / 4.0 × 10' },
                    F: { name: 'Faculty Legacy', weight: weights.F, normalization: 'min(10, institutionAge / 10)' },
                    I: { name: 'Infrastructure', weight: weights.I, normalization: 'tierScore / 5.0 × 10' },
                    S: { name: 'Scale', weight: weights.S, normalization: 'min(10, courseCount / 5)' },
                    D: { name: 'Demand', weight: weights.D, normalization: 'min(10, placementRate / 10 + naacScore × 0.5)' },
                    U: { name: 'Urban Proximity', weight: weights.U, normalization: 'constant: 5.0 (dataset limitation)' }
                },
                naacLookup: NAAC_SCORES,
                tierLookup: TIER_SCORES,
                rangeOutput: '0 – 100'
            },
            recomputeEndpoint: '/api/verify/recompute',
            recomputeGuide: 'https://ce-intelligence-eight.vercel.app/developers'
        });
    } catch (err) {
        logger.error('[Verify] methodology error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── GET /api/verify/institution/:id/manifest ──────────────────────────────

router.get('/institution/:id/manifest', async (req, res) => {
    try {
        const college = await College.findOne({ id: req.params.id },
            {
                id: 1, name: 1, ceiScore: 1, 'meta.naacGrade': 1, 'meta.establishedYear': 1,
                rankingTier: 1, courses: 1, 'placements.placementRate': 1
            }
        ).lean();

        if (!college) return res.status(404).json({ error: 'Institution not found.' });

        const version = await ScoringVersion.findOne({ status: 'active' },
            { versionId: 1, weights: 1, datasetHash: 1 }).lean();
        const weights = (version?.weights && Object.keys(version.weights).length) ? version.weights : DEFAULT_WEIGHTS;

        const inputVector = extractVectors(college);
        const recomputedScore = applyFormula(inputVector, weights);
        const scoreDrift = college.ceiScore !== undefined
            ? +(college.ceiScore - recomputedScore).toFixed(4) : null;

        // Record hash — same algorithm as public API
        const { _id, __v, updatedAt, createdAt, ...hashable } = college;
        const recordHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(hashable, Object.keys(hashable).sort()))
            .digest('hex');

        res.json({
            collegeId: college.id,
            collegeName: college.name,
            scoringVersion: version?.versionId || 'unknown',
            datasetHash: version?.datasetHash || null,
            inputVector,
            weights,
            recomputedScore,
            storedCeiScore: college.ceiScore || null,
            scoreDrift,
            mismatch: scoreDrift !== null && Math.abs(scoreDrift) > 0.5,
            recordHash,
            hashAlgorithm: 'SHA-256',
            recomputeInstructions: {
                step1: 'Fetch weights from GET /api/verify/methodology',
                step2: 'Apply formula: sum(weight_i * vector_i) * 10, clamp 0-100',
                step3: 'POST /api/verify/recompute with your computed vectors',
                step4: 'Compare recomputedScore to storedCeiScore. Drift > 0.5 triggers investigation.'
            }
        });
    } catch (err) {
        logger.error('[Verify] manifest error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── POST /api/verify/recompute ────────────────────────────────────────────

/**
 * Accepts raw normalized vector values and recomputes the CEI score.
 * Body: { A, F, I, S, D, U }  (all 0–10 range)
 * Optional: { collegeId } to compare against stored score
 */
router.post('/recompute', async (req, res) => {
    try {
        const { A, F, I, S, D, U, collegeId } = req.body;

        // Validate vectors
        const vectors = { A, F, I, S, D, U: U ?? 5 };
        for (const [k, v] of Object.entries(vectors)) {
            if (v !== undefined && (typeof v !== 'number' || v < 0 || v > 10)) {
                return res.status(400).json({ error: `Vector ${k} must be a number between 0 and 10.` });
            }
        }

        const version = await ScoringVersion.findOne({ status: 'active' },
            { versionId: 1, weights: 1 }).lean();
        const weights = (version?.weights && Object.keys(version.weights).length) ? version.weights : DEFAULT_WEIGHTS;

        const computedScore = applyFormula(vectors, weights);

        let matchVerdict = null;
        let storedScore = null;
        if (collegeId) {
            const college = await College.findOne({ id: collegeId }, { ceiScore: 1 }).lean();
            storedScore = college?.ceiScore ?? null;
            if (storedScore !== null) {
                const drift = Math.abs(computedScore - storedScore);
                matchVerdict = drift <= 0.5 ? 'MATCH' : 'MISMATCH';
                if (matchVerdict === 'MISMATCH') {
                    logger.warn('[Verify] Score mismatch detected', { collegeId, computedScore, storedScore, drift });
                }
            }
        }

        res.json({
            computedScore,
            scoringVersion: version?.versionId || 'unknown',
            weightsUsed: weights,
            vectorsInput: vectors,
            storedScore,
            matchVerdict,
            mismatchInvestigationProtocol: matchVerdict === 'MISMATCH'
                ? 'Mismatch detected. Please open an issue at the CEI GitHub repository with this response payload.'
                : null
        });
    } catch (err) {
        logger.error('[Verify] recompute error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── GET /api/verify/record-hash/:id ──────────────────────────────────────

router.get('/record-hash/:id', async (req, res) => {
    try {
        const college = await College.findOne({ id: req.params.id }).lean();
        if (!college) return res.status(404).json({ error: 'Institution not found.' });

        const { _id, __v, updatedAt, createdAt, ...hashable } = college;
        const recordHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(hashable, Object.keys(hashable).sort()))
            .digest('hex');

        res.json({
            collegeId: college.id,
            collegeName: college.name,
            recordHash,
            hashAlgorithm: 'SHA-256',
            hashInput: 'Canonical sorted JSON of all college fields (excluding _id, __v, updatedAt, createdAt)',
            generatedAt: new Date().toISOString(),
            verifyInstructions: {
                step1: 'Fetch the college record from GET /api/v1/institution/:id',
                step2: 'Remove fields: _id, __v, updatedAt, createdAt',
                step3: 'Sort remaining keys alphabetically',
                step4: 'SHA-256 of JSON.stringify(sortedRecord)',
                step5: 'Compare to this recordHash — they must match exactly'
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
