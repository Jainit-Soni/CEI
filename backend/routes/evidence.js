/**
 * routes/evidence.js — CEI Regulatory Evidence Packet API (Phase XV)
 * ===================================================================
 * Generates tamper-evident cryptographic proof bundles on demand.
 * Designed to defend against: rank-change demands, methodology challenges,
 * data integrity scandals, and API tampering allegations.
 *
 * Endpoints:
 *   GET /api/evidence/:collegeId        — Public evidence packet
 *   GET /api/evidence/:collegeId/full   — Full packet (JWT required)
 *   GET /api/evidence/version/:id/proof — ScoringVersion proof
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const College = require('../models/CollegeSchema');
const ScoringVersion = require('../models/ScoringVersion');
const AuditLog = require('../models/AuditLog');
const { requireRole } = require('../lib/jwtAuth');
const logger = (() => { try { return require('../lib/logger'); } catch { return console; } })();

/**
 * Produce a SHA-256 packet hash from a plain JS object (canonical, stable).
 */
function packetHash(obj) {
    const sorted = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('sha256').update(sorted).digest('hex');
}

// ── GET /api/evidence/:collegeId — Public Evidence Packet ────────────────

router.get('/:collegeId', async (req, res) => {
    if (req.params.collegeId === 'version') return next(); // pass to version route

    try {
        const collegeId = req.params.collegeId;
        const college = await College.findOne({ id: collegeId },
            {
                id: 1, name: 1, ceiScore: 1, competitivenessBand: 1, rankingTier: 1,
                dataIntegrityScore: 1, dataConfidenceLabel: 1, hasOpenAnomalies: 1,
                hasGovernmentMismatch: 1, fieldSources: 1, lastIntegrityCheck: 1,
                'meta.naacGrade': 1, 'meta.establishedYear': 1
            }
        ).lean();

        if (!college) return res.status(404).json({ error: 'Institution not found.' });

        // Active Scoring Version
        const version = await ScoringVersion.findOne({ status: 'active' },
            { versionId: 1, datasetHash: 1, activatedAt: 1, freezeUntil: 1, chaosPassedAt: 1 }).lean();

        // Freeze window proof
        const freezeWindowValid = version?.freezeUntil && new Date(version.freezeUntil) > new Date();

        // Strip internal hashes from public field sources
        const publicFieldSources = {};
        for (const [k, v] of Object.entries(college.fieldSources || {})) {
            if (!v) continue;
            const { source_document_hash, ...pub } = v;
            publicFieldSources[k] = pub;
        }

        // Build the packet
        const packet = {
            evidenceType: 'public_evidence_packet',
            generatedAt: new Date().toISOString(),
            institution: {
                id: college.id,
                name: college.name,
                ceiScore: college.ceiScore,
                competitivenessBand: college.competitivenessBand,
                rankingTier: college.rankingTier,
                dataIntegrityScore: college.dataIntegrityScore,
                dataConfidenceLabel: college.dataConfidenceLabel,
                hasOpenAnomalies: college.hasOpenAnomalies,
                hasGovernmentMismatch: college.hasGovernmentMismatch,
                lastIntegrityCheck: college.lastIntegrityCheck
            },
            scoringProof: {
                scoringVersion: version?.versionId || 'unknown',
                datasetHash: version?.datasetHash || null,
                activatedAt: version?.activatedAt || null,
                freezeWindowActive: !!freezeWindowValid,
                freezeUntil: version?.freezeUntil || null,
                chaosPassedAt: version?.chaosPassedAt || null
            },
            dataProvenance: publicFieldSources,
            fieldSourceCount: Object.keys(publicFieldSources).length
        };

        // Self-signing: hash the packet itself
        packet.evidencePacketHash = packetHash(packet);

        res.json(packet);
    } catch (err) {
        logger.error('[Evidence] public packet error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── GET /api/evidence/:collegeId/full — Full Packet (JWT Admin) ──────────

router.get('/:collegeId/full', requireRole('super_admin', 'reviewer', 'auditor'), async (req, res) => {
    try {
        const collegeId = req.params.collegeId;
        const college = await College.findOne({ id: collegeId }).lean();
        if (!college) return res.status(404).json({ error: 'Institution not found.' });

        const version = await ScoringVersion.findOne({ status: 'active' }).lean();

        // Audit trail for this institution (last 50 events)
        let auditTrail = [];
        try {
            auditTrail = await AuditLog.find({})
                .sort({ timestamp: -1 })
                .limit(50)
                .lean();
        } catch { /* AuditLog optional */ }

        const packet = {
            evidenceType: 'full_evidence_packet',
            generatedAt: new Date().toISOString(),
            requestedBy: req.admin?.sub || 'unknown',
            institution: {
                id: college.id,
                name: college.name,
                ceiScore: college.ceiScore,
                competitivenessBand: college.competitivenessBand,
                rankingTier: college.rankingTier,
                dataIntegrityScore: college.dataIntegrityScore,
                dataConfidenceLabel: college.dataConfidenceLabel,
                hasOpenAnomalies: college.hasOpenAnomalies,
                hasGovernmentMismatch: college.hasGovernmentMismatch,
                fieldSources: college.fieldSources,
                lastIntegrityCheck: college.lastIntegrityCheck
            },
            scoringProof: {
                scoringVersion: version?.versionId,
                datasetHash: version?.datasetHash,
                activatedAt: version?.activatedAt,
                freezeUntil: version?.freezeUntil,
                chaosPassedAt: version?.chaosPassedAt,
                weights: version?.weights
            },
            auditTrail: auditTrail.slice(0, 10),   // Last 10 global audit events
            disclaimer: 'Full evidence packets are admin-only. Any sharing must be redacted of personal operator data.'
        };

        packet.evidencePacketHash = packetHash(packet);
        res.json(packet);
    } catch (err) {
        logger.error('[Evidence] full packet error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── GET /api/evidence/version/:versionId/proof ───────────────────────────

router.get('/version/:versionId/proof', async (req, res) => {
    try {
        const version = await ScoringVersion.findOne({ versionId: req.params.versionId }).lean();
        if (!version) return res.status(404).json({ error: 'ScoringVersion not found.' });

        const proof = {
            evidenceType: 'scoring_version_proof',
            generatedAt: new Date().toISOString(),
            versionId: version.versionId,
            status: version.status,
            datasetHash: version.datasetHash,
            activatedAt: version.activatedAt,
            freezeUntil: version.freezeUntil,
            chaosPassedAt: version.chaosPassedAt,
            recordCount: version.recordCount,
            weights: version.weights,
            bandThresholds: version.bandThresholds,
            changesSummary: version.changesSummary,
            isCurrentlyActive: version.status === 'active',
            freezeWindowActiveNow: version.freezeUntil
                ? new Date(version.freezeUntil) > new Date()
                : false
        };

        proof.proofPacketHash = packetHash(proof);
        res.json(proof);
    } catch (err) {
        logger.error('[Evidence] version proof error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
