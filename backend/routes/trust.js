/**
 * routes/trust.js — CEI Public Trust Reporting API (Phase XVI)
 * =============================================================
 * Public:
 *   POST /api/trust/report                — Submit a data correction report
 *   GET  /api/trust/reports/:collegeId    — View open reports for a college
 *
 * Admin (JWT):
 *   PATCH /api/trust/report/:id/resolve   — Approve or reject a report
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const TrustReport = require('../models/TrustReport');
const ReporterReputation = require('../models/ReporterReputation');
const { requireRole } = require('../lib/jwtAuth');
const rp = require('../lib/reportProcessor');

// ── Rate Limiter: 5 reports per hour per IP ──────────────────────────────────
const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    validate: false,
    keyGenerator: (req) => {
        const rawIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        return rp.hashIp(String(rawIp));
    },
    message: { error: 'Too many reports from this IP. Please wait before submitting again.' }
});

// ── POST /api/trust/report ────────────────────────────────────────────────────
router.post('/report', reportLimiter, async (req, res) => {
    const { collegeId, fieldName, reportedValue, evidenceURL, reportReason } = req.body;

    if (!collegeId || !fieldName || reportedValue === undefined || !reportReason) {
        return res.status(400).json({
            error: 'Required fields: collegeId, fieldName, reportedValue, reportReason.'
        });
    }
    if (reportReason.length < 10) {
        return res.status(400).json({ error: 'reportReason must be at least 10 characters.' });
    }

    const rawIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const ipHash = rp.hashIp(rawIp);
    const reporterId = req.user?.uid || null; // Firebase UID if available

    try {
        // Rate limit check via DB (secondary, in addition to express-rate-limit)
        const allowed = await rp.isWithinRateLimit(ipHash);
        if (!allowed) {
            return res.status(429).json({ error: 'Rate limit exceeded. Max 5 reports per hour.' });
        }

        // Duplicate check
        const duplicate = await rp.checkDuplicate(collegeId, fieldName, reportedValue);

        // Get reporter reputation
        const rep = await rp.getOrCreateReputation(reporterId, ipHash);
        rep.checkAndResetDailyCounter();
        rep.totalReports++;
        rep.lastReportAt = new Date();
        rep.reportsToday++;
        await rep.save();

        // Boost amount tied to reporter trust
        const boostAmount = Math.round(rep.trustScore / 10); // 1–10

        // Create report
        const report = await TrustReport.create({
            collegeId,
            fieldName,
            reportedValue: JSON.stringify(reportedValue),
            evidenceURL: evidenceURL || null,
            reportReason,
            reporterId,
            reporterIpHash: ipHash,
            reporterTrustScore: rep.trustScore,
            isDuplicate: !!duplicate,
            duplicateOf: duplicate?._id || null,
            status: duplicate ? 'duplicate' : 'pending',
            anomalyScoreBoost: boostAmount
        });

        // Only boost anomaly and create task if it's not a duplicate
        if (!duplicate) {
            await rp.boostAnomalyScore(collegeId, fieldName, boostAmount);
            const taskRef = await rp.createVerificationTask(report, rep.trustScore);
            await TrustReport.findByIdAndUpdate(report._id, { verificationTaskRef: taskRef });
        }

        return res.status(201).json({
            reportRef: report._id,
            status: report.status,
            isDuplicate: report.isDuplicate,
            message: duplicate
                ? 'This report appears to be a duplicate of an existing open report. It has been logged.'
                : 'Report submitted. A verification task has been created.',
            anomalyBoostApplied: !duplicate ? boostAmount : 0
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ── GET /api/trust/reports/:collegeId ────────────────────────────────────────
router.get('/reports/:collegeId', async (req, res) => {
    const { collegeId } = req.params;

    try {
        const reports = await TrustReport.find({
            collegeId,
            status: { $in: ['pending', 'validated'] }
        })
            .select('fieldName reportedValue reportReason status createdAt isDuplicate')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        return res.json({
            collegeId,
            totalOpenReports: reports.filter(r => r.status === 'pending').length,
            reports
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ── PATCH /api/trust/report/:id/resolve (admin) ──────────────────────────────
router.patch('/report/:id/resolve', requireRole('super_admin', 'reviewer'), async (req, res) => {
    const { id } = req.params;
    const { outcome, reviewNote } = req.body;

    if (!['validated', 'rejected'].includes(outcome)) {
        return res.status(400).json({ error: 'outcome must be "validated" or "rejected".' });
    }

    try {
        const result = await rp.resolveReport(id, outcome, req.admin?.sub);

        // Attach review note
        if (reviewNote) {
            await TrustReport.findByIdAndUpdate(id, { reviewNote });
        }

        return res.json({
            message: `Report ${outcome}.`,
            reportId: id,
            updatedTrustScore: result.updatedTrustScore,
            outcome
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
