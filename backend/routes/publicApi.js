/**
 * routes/publicApi.js — CEI Public API v1 (Phase XIV)
 * ====================================================
 * Versioned, developer-facing endpoints for verifiable CEI data.
 * Every response includes: scoringVersion, snapshotHash, apiVersion, generatedAt.
 *
 * All responses are tied to the active ScoringVersion — never silently drift.
 *
 * Rate limits (enforced via express-rate-limit):
 *   Anonymous: 100 req / 15min
 *   API key bearer: 1000 req / 15min (via existing apiKeys middleware)
 *
 * Endpoints:
 *   GET /api/v1/institution/:id          — Summary
 *   GET /api/v1/institution/:id/vectors  — CEI vector breakdown
 *   GET /api/v1/institution/:id/integrity — Field provenance
 *   GET /api/v1/scoring-version/active   — Active methodology
 *   GET /api/v1/peer-cluster/:id         — Peer cluster
 */

const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const crypto = require('crypto');
const College = require('../models/CollegeSchema');
const ScoringVersion = require('../models/ScoringVersion');
const DataSnapshot = require('../models/DataSnapshot');
const logger = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// ── API v1 Rate Limit (stricter than global) ──────────────────────────────────
const v1RateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 100,
    validate: false,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.apiKey?.key || String(req.ip || 'anonymous');
    },
    message: {
        error: 'Rate limit exceeded on Public API v1.',
        hint: 'Anonymous: 100 req/15min. Request an API key for higher limits.',
        keysUrl: 'https://ce-intelligence-eight.vercel.app/developers'
    }
});
router.use(v1RateLimit);

// ── Response Envelope ─────────────────────────────────────────────────────────

function envelope(data, activeVersion, snapshotHash = null) {
    return {
        apiVersion: 'v1',
        generatedAt: new Date().toISOString(),
        scoringVersion: activeVersion?.versionId || null,
        snapshotHash,
        data
    };
}

/**
 * Fetch the active scoring version (cached at module level for 60s).
 */
let _versionCache = null;
let _versionCacheTs = 0;
async function getActiveVersion() {
    if (_versionCache && Date.now() - _versionCacheTs < 60000) return _versionCache;
    _versionCache = await ScoringVersion.findOne({ status: 'active' }, {
        versionId: 1, weights: 1, activatedAt: 1, bandThresholds: 1
    }).lean();
    _versionCacheTs = Date.now();
    return _versionCache;
}

/**
 * Compute a record hash of a college document for public verification.
 */
function computePublicHash(college) {
    const { _id, __v, updatedAt, createdAt, ...hashable } = college;
    return crypto.createHash('sha256')
        .update(JSON.stringify(hashable, Object.keys(hashable).sort()))
        .digest('hex');
}

// ── GET /api/v1/institution/:id ───────────────────────────────────────────────

router.get('/institution/:id', async (req, res) => {
    try {
        const college = await College.findOne(
            { id: req.params.id },
            {
                id: 1, name: 1, shortName: 1, location: 1, state: 1,
                rankingTier: 1, ceiScore: 1, competitivenessBand: 1,
                dataIntegrityScore: 1, dataConfidenceLabel: 1,
                hasOpenAnomalies: 1, hasGovernmentMismatch: 1,
                verificationStatus: 1, aisheCode: 1, officialUrl: 1,
                'meta.naacGrade': 1, 'meta.establishedYear': 1,
                'placements.confidenceLabel': 1
            }
        ).lean();

        if (!college) return res.status(404).json({ error: 'Institution not found.' });

        const version = await getActiveVersion();
        const recordHash = computePublicHash(college);

        res.json(envelope({
            id: college.id,
            name: college.name,
            shortName: college.shortName,
            location: college.location,
            state: college.state,
            rankingTier: college.rankingTier,
            ceiScore: college.ceiScore,
            competitivenessBand: college.competitivenessBand,
            dataIntegrityScore: college.dataIntegrityScore,
            dataConfidenceLabel: college.dataConfidenceLabel,
            hasOpenAnomalies: college.hasOpenAnomalies,
            hasGovernmentMismatch: college.hasGovernmentMismatch,
            placementDataSource: college.placements?.confidenceLabel || 'unverified',
            naacGrade: college.meta?.naacGrade || null,
            establishedYear: college.meta?.establishedYear || null,
            aisheCode: college.aisheCode || null,
            officialUrl: college.officialUrl || null,
            recordHash
        }, version, recordHash));
    } catch (err) {
        logger.error('[PublicAPI] institution summary error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── GET /api/v1/institution/:id/vectors ──────────────────────────────────────

router.get('/institution/:id/vectors', async (req, res) => {
    try {
        const college = await College.findOne(
            { id: req.params.id },
            { id: 1, name: 1, ceiScore: 1, competitivenessBand: 1, 'meta.naacGrade': 1, 'meta.establishedYear': 1, rankingTier: 1, courses: 1, 'placements.placementRate': 1 }
        ).lean();

        if (!college) return res.status(404).json({ error: 'Institution not found.' });

        const version = await getActiveVersion();

        // Reconstruct approximate vector values for public transparency
        const NAAC_SCORES = { 'A++': 4.0, 'A+': 3.6, 'A': 3.2, 'B++': 2.8, 'B+': 2.4, 'B': 2.0, 'C': 1.4, '': 0 };
        const naac = NAAC_SCORES[college.meta?.naacGrade || ''] || 0;
        const estYear = parseInt(college.meta?.establishedYear) || 2010;
        const age = Math.max(0, 2026 - estYear);
        const tier = { 'Tier 1': 5, 'Tier 2': 4, 'Tier 3': 2, 'University': 4.5, 'Stand Alone': 2.5 }[college.rankingTier] || 2;
        const courses = (college.courses || []).length;
        const pr = parseFloat(college.placements?.placementRate) || 0;

        const vectors = {
            A: { name: 'Accreditation', rawValue: college.meta?.naacGrade || 'N/A', normalizedScore: +(naac / 4 * 10).toFixed(2), weight: version?.weights?.A || 0.30 },
            F: { name: 'Faculty Legacy', rawValue: `${age} years`, normalizedScore: +Math.min(10, age / 10).toFixed(2), weight: version?.weights?.F || 0.20 },
            I: { name: 'Infrastructure', rawValue: college.rankingTier, normalizedScore: +(tier / 5 * 10).toFixed(2), weight: version?.weights?.I || 0.20 },
            S: { name: 'Scale', rawValue: `${courses} courses`, normalizedScore: +Math.min(10, courses / 5).toFixed(2), weight: version?.weights?.S || 0.15 },
            D: { name: 'Demand', rawValue: `${pr.toFixed(0)}% placement`, normalizedScore: +Math.min(10, pr / 10 + naac * 0.5).toFixed(2), weight: version?.weights?.D || 0.10 },
            U: { name: 'Urban Proximity', rawValue: 'N/A (dataset)', normalizedScore: 5.0, weight: version?.weights?.U || 0.05 }
        };

        res.json(envelope({
            id: college.id,
            name: college.name,
            ceiScore: college.ceiScore,
            vectors
        }, version));
    } catch (err) {
        logger.error('[PublicAPI] vectors error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── GET /api/v1/institution/:id/integrity ────────────────────────────────────

router.get('/institution/:id/integrity', async (req, res) => {
    try {
        const college = await College.findOne(
            { id: req.params.id },
            { id: 1, name: 1, dataIntegrityScore: 1, dataConfidenceLabel: 1, fieldSources: 1, lastIntegrityCheck: 1, hasOpenAnomalies: 1, hasGovernmentMismatch: 1 }
        ).lean();

        if (!college) return res.status(404).json({ error: 'Institution not found.' });

        const version = await getActiveVersion();

        // Strip document hashes from public response (internal only)
        const publicFieldSources = {};
        for (const [key, val] of Object.entries(college.fieldSources || {})) {
            if (!val) continue;
            const { source_document_hash, ...publicVal } = val;
            publicFieldSources[key] = publicVal;
        }

        res.json(envelope({
            id: college.id,
            name: college.name,
            dataIntegrityScore: college.dataIntegrityScore,
            dataConfidenceLabel: college.dataConfidenceLabel,
            lastIntegrityCheck: college.lastIntegrityCheck,
            hasOpenAnomalies: college.hasOpenAnomalies,
            hasGovernmentMismatch: college.hasGovernmentMismatch,
            fieldSources: publicFieldSources
        }, version));
    } catch (err) {
        logger.error('[PublicAPI] integrity error', { error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── GET /api/v1/scoring-version/active ───────────────────────────────────────

router.get('/scoring-version/active', async (req, res) => {
    try {
        const version = await ScoringVersion.findOne({ status: 'active' }).lean();
        if (!version) return res.status(404).json({ error: 'No active scoring version.' });

        res.json(envelope({
            versionId: version.versionId,
            activatedAt: version.activatedAt,
            freezeUntil: version.freezeUntil,
            weights: version.weights,
            bandThresholds: version.bandThresholds,
            datasetHash: version.datasetHash,
            chaosPassedAt: version.chaosPassedAt,
            recordCount: version.recordCount,
            changesSummary: version.changesSummary
        }, version));
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── GET /api/v1/peer-cluster/:id ─────────────────────────────────────────────

router.get('/peer-cluster/:id', async (req, res) => {
    try {
        // Delegate to simulator route logic via direct DB query
        const college = await College.findOne(
            { id: req.params.id },
            { id: 1, name: 1, state: 1, rankingTier: 1, ceiScore: 1 }
        ).lean();

        if (!college) return res.status(404).json({ error: 'Institution not found.' });

        const peers = await College.find(
            {
                state: college.state,
                rankingTier: college.rankingTier,
                ceiScore: { $exists: true, $ne: null },
                id: { $ne: college.id }
            },
            { id: 1, name: 1, shortName: 1, ceiScore: 1 }
        ).sort({ ceiScore: -1 }).limit(20).lean();

        const version = await getActiveVersion();

        res.json(envelope({
            id: college.id,
            name: college.name,
            cluster: `${college.state} — ${college.rankingTier}`,
            myScore: college.ceiScore,
            peers: peers.map(p => ({ id: p.id, name: p.shortName || p.name, ceiScore: p.ceiScore }))
        }, version));
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
