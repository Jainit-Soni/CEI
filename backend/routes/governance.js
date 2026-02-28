/**
 * routes/governance.js — CEI Internal Governance Dashboard API
 * =============================================================
 * Admin-only endpoints for the Scoring Constitution control centre.
 * All routes require X-Admin-Secret header.
 *
 * Endpoints:
 *   POST /api/governance/version/draft          — Create draft from manifest
 *   GET  /api/governance/versions               — All versions (full detail)
 *   GET  /api/governance/version/:id            — Single version detail
 *   POST /api/governance/version/:id/activate   — Activate a draft version
 *   POST /api/governance/version/:id/certify-chaos — Record chaos suite pass
 *   GET  /api/governance/disputes               — All disputes
 *   PATCH /api/governance/dispute/:ref          — Update dispute status/resolution
 *   GET  /api/governance/diff/:v1/:v2           — Weight diff between two versions
 *   GET  /api/governance/health                 — Governance system health
 */

const express = require('express');
const router = express.Router();
const ScoringVersion = require('../models/ScoringVersion');
const Dispute = require('../models/Dispute');
const { activateVersion, createDraftFromManifest } = require('../services/governanceService');
const logger = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// ── Admin Guard ────────────────────────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
    const { ADMIN_SECRET } = process.env;
    if (!ADMIN_SECRET) {
        return res.status(503).json({ error: 'Governance system not configured (ADMIN_SECRET missing)' });
    }
    if (req.headers['x-admin-secret'] !== ADMIN_SECRET) {
        logger.audit && logger.audit('[Governance] Unauthorized access attempt', {
            ip: req.ip, path: req.originalUrl, requestId: req.id
        });
        return res.status(403).json({ error: 'Unauthorized' });
    }
    next();
};


// ─── VERSION MANAGEMENT ───────────────────────────────────────────────────────

// POST /api/governance/version/draft
// Create a new DRAFT ScoringVersion from the latest scoring manifest
router.post('/version/draft', requireAdmin, async (req, res) => {
    try {
        const { label } = req.body;
        const draft = await createDraftFromManifest(label || '');
        logger.audit && logger.audit('[Governance] Draft version created', { versionId: draft.versionId, requestId: req.id });
        res.status(201).json({ success: true, version: draft });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/governance/versions
// Full version history with all constitutional fields
router.get('/versions', requireAdmin, async (req, res) => {
    try {
        const versions = await ScoringVersion.find({})
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, count: versions.length, versions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/governance/version/:id
router.get('/version/:id', requireAdmin, async (req, res) => {
    try {
        const version = await ScoringVersion.findOne({ versionId: req.params.id }).lean();
        if (!version) return res.status(404).json({ error: 'Version not found' });
        res.json({ success: true, version });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/governance/version/:id/activate
// Gate-checked activation protocol
router.post('/version/:id/activate', requireAdmin, async (req, res) => {
    try {
        const adminSecret = req.headers['x-admin-secret'];
        const { emergencyOverride, emergencyReason, skipChaosCertification } = req.body;

        logger.audit && logger.audit('[Governance] Activation initiated', {
            versionId: req.params.id, requestId: req.id, emergencyOverride
        });

        const receipt = await activateVersion(req.params.id, adminSecret, {
            emergencyOverride,
            emergencyReason,
            skipChaosCertification: skipChaosCertification === true,
            operator: req.headers['x-operator'] || 'admin',
        });

        if (!receipt.success) {
            return res.status(400).json({ success: false, gates: receipt.gates, error: receipt.error });
        }

        res.json({ success: true, receipt });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/governance/version/:id/certify-chaos
// Record that the chaos suite has passed for this version's configuration
router.post('/version/:id/certify-chaos', requireAdmin, async (req, res) => {
    try {
        const { chaosReportPath } = req.body;
        const version = await ScoringVersion.findOne({ versionId: req.params.id, status: 'draft' });
        if (!version) return res.status(404).json({ error: 'Draft version not found' });

        // Use direct collection update to bypass our pre-hook (this is an allowed draft field update)
        await ScoringVersion.collection.updateOne(
            { versionId: req.params.id },
            { $set: { chaosPassedAt: new Date(), chaosReportPath: chaosReportPath || '' } }
        );

        logger.audit && logger.audit('[Governance] Chaos certification recorded', {
            versionId: req.params.id, requestId: req.id
        });

        res.json({ success: true, chaosPassedAt: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ─── DIFF / COMPARISON ────────────────────────────────────────────────────────

// GET /api/governance/diff/:v1/:v2
// Compare weights and configuration between two versions
router.get('/diff/:v1/:v2', requireAdmin, async (req, res) => {
    try {
        const [ver1, ver2] = await Promise.all([
            ScoringVersion.findOne({ versionId: req.params.v1 }).lean(),
            ScoringVersion.findOne({ versionId: req.params.v2 }).lean(),
        ]);

        if (!ver1 || !ver2) return res.status(404).json({ error: 'One or both versions not found' });

        const diff = {
            v1: { id: ver1.versionId, createdAt: ver1.createdAt, datasetHash: ver1.datasetHash },
            v2: { id: ver2.versionId, createdAt: ver2.createdAt, datasetHash: ver2.datasetHash },
            weightDelta: {},
            datasetChanged: ver1.datasetHash !== ver2.datasetHash,
            penaltyDelta: {
                maxPenalty: ver2.penaltyRules?.maxPenalty - ver1.penaltyRules?.maxPenalty
            },
            summary: ver2.changesSummary || 'No summary recorded.'
        };

        Object.keys(ver2.weights).forEach(k => {
            const delta = (ver2.weights[k] - (ver1.weights[k] || 0));
            if (Math.abs(delta) > 0.0001) {
                diff.weightDelta[k] = {
                    from: ver1.weights[k],
                    to: ver2.weights[k],
                    delta: parseFloat(delta.toFixed(4))
                };
            }
        });

        res.json({ success: true, diff });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ─── DISPUTE MANAGEMENT ───────────────────────────────────────────────────────

// GET /api/governance/disputes
router.get('/disputes', requireAdmin, async (req, res) => {
    try {
        const { status, claimType, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (claimType) filter.claimType = claimType;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, parseInt(limit));
        const disputes = await Dispute.find(filter)
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean();
        const total = await Dispute.countDocuments(filter);

        res.json({ success: true, total, page: pageNum, disputes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/governance/dispute/:ref
// Update dispute status and resolution note
router.patch('/dispute/:ref', requireAdmin, async (req, res) => {
    try {
        const { status, resolutionNote, resolvedScoringVersionId } = req.body;
        const VALID_STATUSES = ['pending', 'under_review', 'resolved', 'rejected', 'escalated'];

        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        const update = {
            status,
            reviewedBy: req.headers['x-operator'] || 'admin',
            updatedAt: new Date(),
        };
        if (resolutionNote) update.resolutionNote = resolutionNote;
        if (resolvedScoringVersionId) update.resolvedScoringVersionId = resolvedScoringVersionId;
        if (status === 'resolved' || status === 'rejected') update.resolvedAt = new Date();

        const dispute = await Dispute.findOneAndUpdate(
            { disputeRef: req.params.ref },
            { $set: update },
            { new: true }
        );
        if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

        logger.audit && logger.audit('[Governance] Dispute updated', {
            ref: req.params.ref, status, requestId: req.id
        });
        res.json({ success: true, dispute });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ─── SYSTEM HEALTH ────────────────────────────────────────────────────────────

// GET /api/governance/health
router.get('/health', requireAdmin, async (req, res) => {
    try {
        const [activeVersion, totalVersions, pendingDisputes, totalDisputes] = await Promise.all([
            ScoringVersion.findOne({ status: 'active' }, {
                versionId: 1, activatedAt: 1, freezeUntil: 1, engineVersion: 1,
                recordCount: 1, eliteCount: 1, datasetHash: 1
            }).lean(),
            ScoringVersion.countDocuments(),
            Dispute.countDocuments({ status: 'pending' }),
            Dispute.countDocuments(),
        ]);

        const freezeDaysLeft = activeVersion?.freezeUntil
            ? Math.max(0, ((new Date(activeVersion.freezeUntil) - Date.now()) / 86400000).toFixed(1))
            : null;

        res.json({
            success: true,
            governance: {
                activeVersion,
                freezeDaysRemaining: freezeDaysLeft,
                totalVersions,
                pendingDisputes,
                totalDisputes,
                status: activeVersion ? 'CONSTITUTIONAL' : 'NO_ACTIVE_VERSION',
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
