/**
 * routes/transparency.js — CEI Public Transparency API v2.0
 * ===========================================================
 * Public-facing endpoints for governance accountability.
 * No authentication required — these are designed for public inspection.
 *
 * Endpoints:
 *   GET /api/transparency/versions              — Scoring version history (public fields)
 *   GET /api/transparency/version/:id           — Full public detail of a version
 *   GET /api/transparency/active                — Currently active scoring methodology
 *   GET /api/transparency/institution/:id/history — Score provenance for one institution
 *   POST /api/transparency/dispute              — Submit a dispute
 *   GET /api/transparency/disputes              — Publicly visible disputes (anonymized)
 *   GET /api/transparency/methodology           — Machine-readable methodology summary
 */

const express = require('express');
const router = express.Router();
const ScoringVersion = require('../models/ScoringVersion');
const Dispute = require('../models/Dispute');
const mongoose = require('mongoose');

// ── Serialise a version for public view (strip internal fields) ──────────────
function publicVersion(v) {
    return {
        versionId: v.versionId,
        label: v.label,
        engineVersion: v.engineVersion,
        status: v.status,
        activatedAt: v.activatedAt,
        archivedAt: v.archivedAt,
        freezeUntil: v.freezeUntil,
        recordCount: v.recordCount,
        eliteCount: v.eliteCount,
        volatileCount: v.volatileCount,
        datasetHash: v.datasetHash,        // Allows public verification
        weights: v.weights,
        bandThresholds: v.bandThresholds,
        graceRules: v.graceRules,
        penaltyRules: v.penaltyRules,
        monteCarloConfig: v.monteCarloConfig,
        changesSummary: v.changesSummary,
        previousVersionId: v.previousVersionId,
        chaosPassedAt: v.chaosPassedAt,     // Public proof of chaos certification
    };
}

// ── GET /api/transparency/versions ────────────────────────────────────────────
router.get('/versions', async (req, res) => {
    try {
        const versions = await ScoringVersion.find(
            { status: { $in: ['active', 'archived'] } },
        ).sort({ createdAt: -1 }).limit(20).lean();

        res.json({
            success: true,
            count: versions.length,
            versions: versions.map(publicVersion),
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load version history' });
    }
});

// ── GET /api/transparency/active ──────────────────────────────────────────────
router.get('/active', async (req, res) => {
    try {
        const active = await ScoringVersion.findOne({ status: 'active' }).lean();
        if (!active) return res.status(404).json({ error: 'No active scoring version found' });

        res.json({ success: true, version: publicVersion(active) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load active version' });
    }
});

// ── GET /api/transparency/version/:id ─────────────────────────────────────────
router.get('/version/:id', async (req, res) => {
    try {
        const version = await ScoringVersion.findOne({
            versionId: req.params.id,
            status: { $in: ['active', 'archived'] }
        }).lean();

        if (!version) return res.status(404).json({ error: 'Version not found or not yet published' });

        res.json({ success: true, version: publicVersion(version) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load version' });
    }
});

// ── GET /api/transparency/institution/:id/history ─────────────────────────────
router.get('/institution/:id/history', async (req, res) => {
    try {
        const College = mongoose.connection.db.collection('colleges');
        const college = await College.findOne(
            { id: req.params.id },
            {
                projection: {
                    id: 1, name: 1, ceiScore: 1, competitivenessBand: 1,
                    ceiEngineVersion: 1, ceiScoredAt: 1,
                    stabilityIndex: 1, confidenceBadge: 1, isScoreVolatile: 1,
                    _recordHash: 1
                }
            }
        );
        if (!college) return res.status(404).json({ error: 'Institution not found' });

        // Fetch the active version to provide methodology context
        const activeVersion = await ScoringVersion.findOne({ status: 'active' },
            { versionId: 1, activatedAt: 1, weights: 1, engineVersion: 1 }).lean();

        res.json({
            success: true,
            institution: {
                id: college.id,
                name: college.name,
                ceiScore: college.ceiScore,
                band: college.competitivenessBand,
                stabilityIndex: college.stabilityIndex,
                confidenceBadge: college.confidenceBadge,
                isScoreVolatile: college.isScoreVolatile,
                scoredAt: college.ceiScoredAt,
                engineVersion: college.ceiEngineVersion,
                recordHash: college._recordHash,    // Allows tamper verification
            },
            methodology: activeVersion ? {
                versionId: activeVersion.versionId,
                activatedAt: activeVersion.activatedAt,
                weights: activeVersion.weights,
            } : null,
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch institution history' });
    }
});

// ── GET /api/transparency/methodology ─────────────────────────────────────────
// Machine-readable current methodology summary for public auditors
router.get('/methodology', async (req, res) => {
    try {
        const active = await ScoringVersion.findOne({ status: 'active' }).lean();
        if (!active) return res.status(404).json({ error: 'No methodology published yet' });

        const VECTOR_DESCRIPTIONS = {
            A: 'Accreditation quality (NAAC grade or elite proxy)',
            F: 'Faculty legacy (institutional age as proxy for stability)',
            I: 'Infrastructure capacity (derived from scale and category)',
            S: 'Scale of institution (University > College > Standalone)',
            D: 'Demand and selectivity (accreditation × elite bonus)',
            U: 'Urban proximity (deterministic location spread)',
        };

        res.json({
            success: true,
            methodology: {
                title: 'CEI Scoring Methodology',
                versionId: active.versionId,
                engineVersion: active.engineVersion,
                activatedAt: active.activatedAt,
                datasetHash: active.datasetHash,
                chaosPassedAt: active.chaosPassedAt,
                stability: {
                    monteCarloRuns: active.monteCarloConfig?.runs,
                    noisePct: active.monteCarloConfig?.noisePct,
                    freezeWindowDays: active.monteCarloConfig?.stabilityDays,
                },
                scoringFormula: {
                    description: 'CEI_SCORE = eCDF(Σ(Wi × Zi × 15)) − Penalty + GraceAdjustment',
                    vectors: Object.keys(active.weights).map(k => ({
                        code: k,
                        description: VECTOR_DESCRIPTIONS[k] || k,
                        weight: active.weights[k],
                        weightPct: `${(active.weights[k] * 100).toFixed(0)}%`,
                    })),
                    weightSum: Object.values(active.weights).reduce((s, v) => s + v, 0).toFixed(4),
                    penaltyMax: active.penaltyRules?.maxPenalty,
                    graceProtocol: active.graceRules?.assignment,
                },
                bands: active.bandThresholds,
                stats: {
                    totalInstitutions: active.recordCount,
                    eliteCount: active.eliteCount,
                    volatileCount: active.volatileCount,
                },
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load methodology' });
    }
});

// ── POST /api/transparency/dispute ────────────────────────────────────────────
router.post('/dispute', async (req, res) => {
    try {
        const {
            institutionId, institutionName, claimType, description,
            contactEmail, evidenceLinks, submittedBy
        } = req.body;

        // Input validation
        if (!institutionName || institutionName.length > 300) {
            return res.status(400).json({ error: 'Institution name is required (max 300 chars)' });
        }
        if (!description || description.length < 20 || description.length > 3000) {
            return res.status(400).json({ error: 'Description must be 20–3000 characters' });
        }
        const VALID_TYPES = ['incorrect_score', 'wrong_band', 'missing_data', 'grace_protocol_issue', 'data_corruption', 'other'];
        if (!VALID_TYPES.includes(claimType)) {
            return res.status(400).json({ error: 'Invalid claim type' });
        }
        if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
            return res.status(400).json({ error: 'Invalid contact email' });
        }

        // Find current active version to link the dispute
        const activeVersion = await ScoringVersion.findOne({ status: 'active' }, { versionId: 1 }).lean();

        // Get current score for context
        const College = mongoose.connection.db.collection('colleges');
        const college = institutionId
            ? await College.findOne({ id: institutionId }, { projection: { ceiScore: 1, competitivenessBand: 1 } })
            : null;

        const dispute = await Dispute.create({
            institutionId: institutionId || null,
            institutionName: institutionName.trim().slice(0, 300),
            scoringVersionId: activeVersion?.versionId || 'UNKNOWN',
            ceiScoreAtDispute: college?.ceiScore || null,
            bandAtDispute: college?.competitivenessBand || null,
            claimType,
            description: description.trim(),
            evidenceLinks: Array.isArray(evidenceLinks) ? evidenceLinks.slice(0, 5) : [],
            contactEmail: contactEmail || null,
            submittedBy: (submittedBy || 'anonymous').slice(0, 200),
        });

        res.status(201).json({
            success: true,
            disputeRef: dispute.disputeRef,
            message: 'Dispute recorded. Our governance team reviews all submissions within 7 business days.',
            scoringVersionDisputed: activeVersion?.versionId,
        });
    } catch (err) {
        console.error('[Transparency] Dispute error:', err.message);
        res.status(500).json({ error: 'Failed to submit dispute' });
    }
});

// ── GET /api/transparency/disputes ────────────────────────────────────────────
// Public view — anonymized (strips contact email, shows resolution notes)
router.get('/disputes', async (req, res) => {
    try {
        const { scoringVersionId, claimType, status, page = 1 } = req.query;
        const filter = { isPublic: true };
        if (scoringVersionId) filter.scoringVersionId = scoringVersionId;
        if (claimType) filter.claimType = claimType;
        if (status) filter.status = status;

        const pageNum = Math.max(1, parseInt(page));
        const disputes = await Dispute.find(filter, {
            // Strip PII for public view
            contactEmail: 0,
            submittedBy: 0,
        }).sort({ createdAt: -1 }).skip((pageNum - 1) * 20).limit(20).lean();

        const total = await Dispute.countDocuments(filter);
        res.json({ success: true, total, page: pageNum, disputes });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load disputes' });
    }
});

module.exports = router;
