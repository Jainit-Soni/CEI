/**
 * routes/verifiedData.js — CEI National Data Verification API (Phase XVI)
 * =========================================================================
 * Endpoints for querying and submitting verified field data.
 *
 * Public:
 *   GET /api/verified/:collegeId            — All 12 fields with confidence scores
 *   GET /api/verified/:collegeId/:fieldName — Single field with sources
 *
 * Admin (JWT):
 *   POST /api/verified/submit               — Submit new source evidence for a field
 */

const express = require('express');
const router = express.Router();

const VerifiedField = require('../models/VerifiedField');
const SourceEvidence = require('../models/SourceEvidence');
const { requireRole } = require('../lib/jwtAuth');
const {
    computeConfidence, computeRecency, computeConsistency, deriveStatus
} = require('../lib/confidenceEngine');

// ── Redis (optional, graceful degradation) ─────────────────────────────────
let redisClient = null;
try { redisClient = require('../lib/redisClient').getClient(); } catch { /* no cache */ }

async function cacheGet(key) {
    try { const v = await redisClient?.get(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function cacheSet(key, val, ttlSec = 3600) {
    try { await redisClient?.set(key, JSON.stringify(val), 'EX', ttlSec); } catch { /* ignore */ }
}

// ── GET /api/verified/:collegeId ────────────────────────────────────────────
router.get('/:collegeId', async (req, res) => {
    const { collegeId } = req.params;
    const cacheKey = `verified:all:${collegeId}`;

    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ source: 'cache', data: cached });

    try {
        const fields = await VerifiedField.find({ collegeId }).lean();

        const result = fields.map(f => ({
            fieldName: f.fieldName,
            fieldValue: f.fieldValue,
            confidenceScore: f.confidenceScore,
            verificationStatus: f.verificationStatus,
            sourceCount: f.sourceCount,
            lastVerifiedAt: f.lastVerifiedAt
        }));

        await cacheSet(cacheKey, result, 3600);
        return res.json({ source: 'db', data: result });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ── GET /api/verified/:collegeId/:fieldName ─────────────────────────────────
router.get('/:collegeId/:fieldName', async (req, res) => {
    const { collegeId, fieldName } = req.params;

    try {
        const field = await VerifiedField.findOne({ collegeId, fieldName }).lean();
        if (!field) return res.status(404).json({ error: 'No verified data for this field.' });

        const sources = await SourceEvidence.find({
            verifiedFieldId: { $in: field.sourceIds },
            isActive: true
        }).lean();

        return res.json({
            fieldName: field.fieldName,
            fieldValue: field.fieldValue,
            confidenceScore: field.confidenceScore,
            verificationStatus: field.verificationStatus,
            anomalyBoost: field.anomalyBoost,
            lastVerifiedAt: field.lastVerifiedAt,
            sources: sources.map(s => ({
                sourceType: s.sourceType,
                sourceURL: s.sourceURL,
                capturedAt: s.capturedAt,
                extractionMethod: s.extractionMethod,
                trustLevel: s.trustLevel
                // rawValue intentionally omitted from public API
            }))
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ── POST /api/verified/submit (admin JWT) ───────────────────────────────────
router.post('/submit', requireRole('super_admin', 'data_curator'), async (req, res) => {
    const {
        collegeId, fieldName, fieldValue,
        sourceType, sourceURL, capturedAt,
        extractionMethod, rawValue, trustLevel
    } = req.body;

    if (!collegeId || !fieldName || !sourceType || rawValue === undefined || !trustLevel) {
        return res.status(400).json({ error: 'Missing required fields: collegeId, fieldName, sourceType, rawValue, trustLevel.' });
    }

    try {
        // Upsert the VerifiedField
        let vf = await VerifiedField.findOne({ collegeId, fieldName });
        if (!vf) {
            vf = new VerifiedField({ collegeId, fieldName });
        }

        // Create source evidence
        const evidence = await SourceEvidence.create({
            verifiedFieldId: vf._id || null, // will update after vf saved
            collegeId, fieldName,
            sourceType, sourceURL,
            capturedAt: capturedAt || new Date(),
            extractionMethod: extractionMethod || 'MANUAL',
            rawValue,
            normalizedValue: fieldValue || rawValue,
            trustLevel,
            submittedBy: req.admin?.sub || 'admin'
        });

        // Link evidence and update field
        vf.sourceIds.push(evidence._id);
        if (fieldValue !== undefined) vf.fieldValue = fieldValue;
        vf.lastVerifiedAt = new Date();

        // Recompute confidence
        const allSources = await SourceEvidence.find({ verifiedFieldId: vf._id, isActive: true }).lean();
        const consistency = computeConsistency(allSources);
        const recency = computeRecency(capturedAt || new Date());
        const sources = allSources.map(s => ({ trustLevel: s.trustLevel }));

        vf.confidenceScore = computeConfidence({ sources, consistency, recency, historicalStability: 0.8 });
        vf.verificationStatus = deriveStatus(vf.confidenceScore);

        await vf.save();

        // Fix the evidence's verifiedFieldId now that vf is saved
        evidence.verifiedFieldId = vf._id;
        await evidence.save();

        // Bust cache
        await cacheSet(`verified:all:${collegeId}`, null, 1);

        return res.status(201).json({
            message: 'Source evidence submitted and confidence recomputed.',
            fieldName,
            confidenceScore: vf.confidenceScore,
            verificationStatus: vf.verificationStatus,
            evidenceId: evidence._id
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
