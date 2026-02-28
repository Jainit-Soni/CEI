/**
 * routes/verification.js — CEI Data Verification & Anomaly API
 * =============================================================
 * Admin routes for the human verification workflow and anomaly detection.
 * Public routes for per-institution integrity scores and data sources.
 *
 * ADMIN routes: require X-Admin-Secret header.
 * PUBLIC routes: open (rate-limited via global middleware).
 */

const express = require('express');
const router = express.Router();

const AnomalyAlert = require('../models/AnomalyAlert');
const VerificationTask = require('../models/VerificationTask');
const College = require('../models/CollegeSchema');
const AuditLog = require('../models/AuditLog');
const verificationSvc = require('../services/verificationService');
const anomalyDetSvc = require('../services/anomalyDetectionService');
const logger = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// ── Auth Middleware ───────────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
    const secret = req.headers['x-admin-secret'];
    if (!process.env.ADMIN_SECRET) {
        return res.status(503).json({ error: 'Admin functionality is disabled (ADMIN_SECRET not set).' });
    }
    if (secret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid admin secret.' });
    }
    next();
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/verification/integrity/:collegeId
 * Returns data integrity score, confidence label, and field sources map
 * for a single institution. Used by the "View Data Sources" panel.
 */
router.get('/integrity/:collegeId', async (req, res) => {
    try {
        const college = await College.findOne(
            { id: req.params.collegeId },
            {
                id: 1, name: 1, shortName: 1,
                dataIntegrityScore: 1, dataConfidenceLabel: 1,
                hasOpenAnomalies: 1, hasGovernmentMismatch: 1,
                lastIntegrityCheck: 1, fieldSources: 1
            }
        ).lean();

        if (!college) {
            return res.status(404).json({ error: 'Institution not found.' });
        }

        // Build public-safe field summary (omit source_document_hash internals)
        const fieldSummary = {};
        const fields = college.fieldSources || {};
        for (const [key, val] of Object.entries(fields)) {
            if (!val) { fieldSummary[key] = { verification_status: 'unverified', confidence_level: 'low' }; continue; }
            fieldSummary[key] = {
                verification_status: val.verification_status,
                source_type: val.source_type,
                source_url: val.source_url || null,
                verifier_type: val.verifier_type,
                confidence_level: val.confidence_level,
                verified_at: val.verified_at || null
            };
        }

        res.json({
            collegeId: college.id,
            collegeName: college.name,
            dataIntegrityScore: college.dataIntegrityScore,
            dataConfidenceLabel: college.dataConfidenceLabel,
            hasOpenAnomalies: college.hasOpenAnomalies,
            hasGovernmentMismatch: college.hasGovernmentMismatch,
            lastIntegrityCheck: college.lastIntegrityCheck,
            fieldSources: fieldSummary
        });
    } catch (err) {
        logger.error('[Verification] integrity fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch integrity data.' });
    }
});

// ═══════════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/verification/queue
 * Paginated, filterable list of pending verification tasks.
 * Query params: page, limit, status, priority, fieldName, collegeId
 */
router.get('/queue', requireAdmin, async (req, res) => {
    try {
        const {
            page = 1, limit = 25,
            status, priority, fieldName, collegeId
        } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (fieldName) filter.fieldName = fieldName;
        if (collegeId) filter.collegeId = collegeId;

        const [tasks, total] = await Promise.all([
            VerificationTask.find(filter)
                .sort({ priority: -1, createdAt: 1 })
                .skip((+page - 1) * +limit)
                .limit(+limit)
                .lean(),
            VerificationTask.countDocuments(filter)
        ]);

        res.json({ tasks, total, page: +page, limit: +limit });
    } catch (err) {
        logger.error('[Verification] queue fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch verification queue.' });
    }
});

/**
 * GET /api/verification/anomalies
 * Paginated, filterable list of anomaly alerts.
 * Query params: page, limit, status, severity, alertType, collegeId
 */
router.get('/anomalies', requireAdmin, async (req, res) => {
    try {
        const {
            page = 1, limit = 25,
            status, severity, alertType, collegeId
        } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (severity) filter.severity = severity;
        if (alertType) filter.alertType = alertType;
        if (collegeId) filter.collegeId = collegeId;

        const [alerts, total] = await Promise.all([
            AnomalyAlert.find(filter)
                .sort({ severity: -1, detectedAt: -1 })
                .skip((+page - 1) * +limit)
                .limit(+limit)
                .lean(),
            AnomalyAlert.countDocuments(filter)
        ]);

        res.json({ alerts, total, page: +page, limit: +limit });
    } catch (err) {
        logger.error('[Verification] anomaly fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch anomaly alerts.' });
    }
});

/**
 * POST /api/verification/task/:taskId/review
 * Submit reviewer notes and optionally change the task status.
 * Body: { status, note, proposedValue, evidenceUrls }
 */
router.post('/task/:taskId/review', requireAdmin, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status, note, proposedValue, evidenceUrls } = req.body;

        const task = await VerificationTask.findById(taskId);
        if (!task) return res.status(404).json({ error: 'Task not found.' });

        const VALID_STATUSES = ['pending', 'under_review', 'verified', 'rejected', 'archived'];
        if (status && !VALID_STATUSES.includes(status)) {
            return res.status(400).json({ error: `Invalid status: ${status}` });
        }

        // Append history entry (immutable trail)
        task.reviewHistory.push({
            status: status || task.status,
            action: 'reviewer_update',
            note: note || '',
            performedBy: req.headers['x-admin-user'] || 'admin',
            performedAt: new Date()
        });

        if (status) task.status = status;
        if (note) task.reviewerNotes = note;
        if (proposedValue !== undefined) task.proposedValue = proposedValue;
        if (evidenceUrls) task.evidenceUrls = evidenceUrls;

        if (['verified', 'rejected', 'archived'].includes(status)) {
            task.resolvedAt = new Date();
        }

        await task.save();

        // If verified, update fieldSources on the College
        if (status === 'verified' && proposedValue !== undefined) {
            try {
                await verificationSvc.setFieldSource(task.collegeId, task.fieldName, {
                    value: proposedValue,
                    source_type: req.body.sourceType || 'official_website',
                    source_url: req.body.sourceUrl || null,
                    verification_status: 'manually_verified',
                    verifier_type: 'human_reviewer',
                    confidence_level: 'high'
                });
            } catch (sfErr) {
                logger.warn(`[Verification] setFieldSource failed for ${task.collegeId}.${task.fieldName}:`, sfErr.message);
            }
        }

        // If resolved, check if any open anomalies remain
        if (['verified', 'rejected'].includes(status)) {
            const openCount = await AnomalyAlert.countDocuments({ collegeId: task.collegeId, status: { $in: ['open', 'reviewing'] } });
            if (openCount === 0) {
                await College.updateOne({ id: task.collegeId }, { $set: { hasOpenAnomalies: false } });
            }
        }

        res.json({ success: true, task });
    } catch (err) {
        logger.error('[Verification] task review error:', err);
        res.status(500).json({ error: 'Failed to update verification task.' });
    }
});

/**
 * POST /api/verification/task/:taskId/approve
 * Supervisor-level final approval gate. Marks task as verified and triggers
 * field source update + integrity score recomputation.
 */
router.post('/task/:taskId/approve', requireAdmin, async (req, res) => {
    try {
        const task = await VerificationTask.findById(req.params.taskId);
        if (!task) return res.status(404).json({ error: 'Task not found.' });
        if (task.status === 'verified') return res.status(409).json({ error: 'Task already verified.' });

        task.status = 'verified';
        task.supervisorApprovedBy = req.headers['x-admin-user'] || 'admin';
        task.supervisorApprovedAt = new Date();
        task.resolvedAt = new Date();
        task.reviewHistory.push({
            status: 'verified',
            action: 'supervisor_approval',
            note: req.body.note || 'Supervisor approved.',
            performedBy: task.supervisorApprovedBy,
            performedAt: new Date()
        });

        await task.save();

        // Trigger integrity recompute
        const integrity = await verificationSvc.computeIntegrityScore(task.collegeId);

        res.json({ success: true, task, integrity });
    } catch (err) {
        logger.error('[Verification] approve error:', err);
        res.status(500).json({ error: 'Failed to approve verification task.' });
    }
});

/**
 * POST /api/verification/scan/run
 * Manually trigger the anomaly detection scanner.
 * Optionally pass: { scoringVersionId }
 */
router.post('/scan/run', requireAdmin, async (req, res) => {
    try {
        const { scoringVersionId } = req.body;
        logger.info('[Verification] Manual scan triggered by admin.');

        // Run asynchronously — return immediately with a scan ID
        const scanRunId = `SCAN-${Date.now()}`;
        res.json({ message: 'Anomaly scan started.', scanRunId });

        // Fire-and-forget
        anomalyDetSvc.runAllScans(scoringVersionId).then(result => {
            logger.info(`[Verification] Manual scan ${scanRunId} complete:`, result);
        }).catch(err => {
            logger.error(`[Verification] Manual scan ${scanRunId} failed:`, err);
        });
    } catch (err) {
        logger.error('[Verification] scan trigger error:', err);
        res.status(500).json({ error: 'Failed to trigger scan.' });
    }
});

/**
 * POST /api/verification/field-source
 * Admin: Manually set or update a field source record for an institution.
 * Body: { collegeId, fieldName, value, source_type, source_url, verifier_type }
 */
router.post('/field-source', requireAdmin, async (req, res) => {
    try {
        const { collegeId, fieldName, value, source_type, source_url, verifier_type, confidence_level } = req.body;

        if (!collegeId || !fieldName) {
            return res.status(400).json({ error: 'collegeId and fieldName are required.' });
        }

        const validation = verificationSvc.validatePlacementData;
        // Basic field name validation
        if (!verificationSvc.CRITICAL_FIELDS.includes(fieldName)) {
            return res.status(400).json({ error: `"${fieldName}" is not a tracked critical field.` });
        }

        const result = await verificationSvc.setFieldSource(collegeId, fieldName, {
            value,
            source_type: source_type || 'official_website',
            source_url: source_url || null,
            verifier_type: verifier_type || 'human_reviewer',
            confidence_level: confidence_level || 'medium',
            verification_status: 'manually_verified'
        });

        res.json({ success: true, integrity: result });
    } catch (err) {
        logger.error('[Verification] field-source update error:', err);
        res.status(500).json({ error: err.message || 'Failed to update field source.' });
    }
});

/**
 * POST /api/verification/integrity/:collegeId/recompute
 * Force an integrity score recomputation for a single institution.
 */
router.post('/integrity/:collegeId/recompute', requireAdmin, async (req, res) => {
    try {
        const result = await verificationSvc.computeIntegrityScore(req.params.collegeId);
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[Verification] recompute error:', err);
        res.status(500).json({ error: err.message || 'Failed to recompute integrity score.' });
    }
});

module.exports = router;
