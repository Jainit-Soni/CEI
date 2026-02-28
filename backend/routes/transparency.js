/**
 * routes/transparency.js — CEI Public Transparency API
 * ======================================================
 * Public-facing endpoints for governance, audit history, and
 * institutional dispute submission.
 */

const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');

// ── GET /api/transparency/versions ─────────────────────────────────────────
// Returns scoring engine run history (last 10 runs, public data only)
router.get('/versions', async (req, res) => {
    try {
        const logs = await AuditLog.find(
            { event: 'SYNC_COMPLETE' },
            {
                engineVersion: 1,
                createdAt: 1,
                totalRecords: 1,
                updatedRecords: 1,
                inputHash: 1,
                outputHash: 1,
                bandDistribution: 1,
                durationMs: 1
            }
        ).sort({ createdAt: -1 }).limit(10).lean();

        res.json({
            success: true,
            versions: logs
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load version history' });
    }
});

// ── GET /api/transparency/institution/:id/history ──────────────────────────
// Returns the score history for a specific institution across scoring versions
// (This requires ceiScoredAt field set during sync, which we now do)
router.get('/institution/:id/history', async (req, res) => {
    try {
        const College = mongoose.connection.db.collection('colleges');
        const college = await College.findOne(
            { id: req.params.id },
            { projection: { name: 1, ceiScore: 1, competitivenessBand: 1, ceiEngineVersion: 1, ceiScoredAt: 1, stabilityIndex: 1, confidenceBadge: 1 } }
        );
        if (!college) return res.status(404).json({ error: 'Institution not found' });
        res.json({ success: true, institution: college });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch institution history' });
    }
});

// ── POST /api/transparency/dispute ────────────────────────────────────────
// Allows institutions or the public to flag a potential scoring discrepancy
router.post('/dispute', async (req, res) => {
    const { institutionId, institutionName, claimType, description, contactEmail } = req.body;

    // Input validation
    if (!description || description.length < 20 || description.length > 2000) {
        return res.status(400).json({ error: 'Description must be between 20 and 2000 characters' });
    }
    if (!claimType || !['incorrect_score', 'missing_data', 'wrong_band', 'other'].includes(claimType)) {
        return res.status(400).json({ error: 'Invalid claim type' });
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        return res.status(400).json({ error: 'Invalid contact email' });
    }

    try {
        const db = mongoose.connection.db;
        const dispute = {
            institutionId: institutionId || null,
            institutionName: (institutionName || '').slice(0, 200),
            claimType,
            description: description.trim(),
            contactEmail: contactEmail || null,
            status: 'pending',
            createdAt: new Date()
        };
        await db.collection('disputes').insertOne(dispute);
        res.json({ success: true, message: 'Dispute submitted. Our team will review within 7 business days.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit dispute' });
    }
});

module.exports = router;
