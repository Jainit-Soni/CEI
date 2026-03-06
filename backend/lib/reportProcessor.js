/**
 * lib/reportProcessor.js — CEI Public Trust Reporting System (Phase XVI)
 * =======================================================================
 * Handles the business logic for trust report processing:
 *   - Duplicate detection
 *   - Anomaly score boosting on VerifiedField
 *   - Reporter reputation updates
 */

const crypto = require('crypto');

const TrustReport = require('../models/TrustReport');
const VerifiedField = require('../models/VerifiedField');
const VerificationTask = require('../models/VerificationTask');
const ReporterReputation = require('../models/ReporterReputation');

/**
 * Hash an IP address for privacy-safe storage.
 * @param {string} ip
 * @returns {string} SHA-256 hex
 */
function hashIp(ip) {
    return crypto.createHash('sha256').update(ip + 'CEI_SALT_2026').digest('hex');
}

/**
 * Check if an identical open report already exists for the same field+value.
 * @returns {TrustReport|null} The duplicate report if found, else null.
 */
async function checkDuplicate(collegeId, fieldName, reportedValue) {
    const existing = await TrustReport.findOne({
        collegeId,
        fieldName,
        reportedValue: JSON.stringify(reportedValue),
        status: { $in: ['pending', 'validated'] }
    }).lean();
    return existing || null;
}

/**
 * Apply an anomaly boost to the relevant VerifiedField, surfacing it for re-review.
 * Creates the VerifiedField document if it does not exist yet.
 *
 * @param {string} collegeId
 * @param {string} fieldName
 * @param {number} boostAmount - defaults to 5
 */
async function boostAnomalyScore(collegeId, fieldName, boostAmount = 5) {
    await VerifiedField.findOneAndUpdate(
        { collegeId, fieldName },
        {
            $inc: { anomalyBoost: boostAmount },
            $setOnInsert: { collegeId, fieldName, confidenceScore: 0 }
        },
        { upsert: true }
    );
}

/**
 * Get or create a ReporterReputation record for a user/IP.
 * @param {string|null} userId
 * @param {string}      ipHash
 * @returns {ReporterReputation}
 */
async function getOrCreateReputation(userId, ipHash) {
    const query = userId ? { userId } : { ipHash };
    let rep = await ReporterReputation.findOne(query);
    if (!rep) {
        rep = new ReporterReputation({ userId: userId || null, ipHash });
    }
    return rep;
}

/**
 * Rate-limit check: max 5 reports per IP per hour.
 * Returns true if the reporter is within limits.
 *
 * @param {string} ipHash
 * @returns {Promise<boolean>} true = allowed, false = rate-limited
 */
async function isWithinRateLimit(ipHash) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const count = await TrustReport.countDocuments({
        reporterIpHash: ipHash,
        createdAt: { $gte: oneHourAgo }
    });
    return count < 5;
}

/**
 * Create a VerificationTask from a validated TrustReport.
 * Skips creation if an identical pending task already exists.
 *
 * @param {TrustReport} report
 * @param {number}      priority - reporter trustScore used to derive priority
 * @returns {string} taskRef
 */
async function createVerificationTask(report, reporterTrustScore = 50) {
    const existing = await VerificationTask.findOne({
        collegeId: report.collegeId,
        fieldName: report.fieldName,
        status: { $in: ['pending', 'under_review'] }
    });

    if (existing) return existing.taskRef;

    const priority = reporterTrustScore >= 80 ? 'high'
        : reporterTrustScore >= 60 ? 'medium'
            : 'low';

    const task = new VerificationTask({
        collegeId: report.collegeId,
        fieldName: report.fieldName,
        source: 'dispute',
        sourceRef: report._id.toString(),
        proposedValue: report.reportedValue,
        evidenceUrls: report.evidenceURL ? [report.evidenceURL] : [],
        priority,
        reviewHistory: [{
            status: 'pending',
            action: 'trust_report_created',
            note: `Created from TrustReport by reporter (trust=${reporterTrustScore}). Reason: ${report.reportReason}`,
            performedBy: 'system'
        }]
    });

    await task.save();
    return task.taskRef;
}

/**
 * Update reporter reputation after admin review outcome.
 *
 * @param {string} reportId  - TrustReport._id
 * @param {'validated'|'rejected'} outcome
 * @param {string|null} adminId
 */
async function resolveReport(reportId, outcome, adminId = null) {
    const report = await TrustReport.findById(reportId);
    if (!report) throw new Error(`TrustReport ${reportId} not found.`);

    report.status = outcome === 'validated' ? 'validated' : 'rejected';
    report.reviewedBy = adminId;
    report.reviewedAt = new Date();
    await report.save();

    // Update reputation
    const ipHash = report.reporterIpHash;
    const userId = report.reporterId;
    const rep = await getOrCreateReputation(userId, ipHash);
    rep.applyOutcome(outcome);
    await rep.save();

    // If validated → update VerifiedField confidence boost (negative — it was confirmed an error)
    if (outcome === 'validated') {
        await VerifiedField.findOneAndUpdate(
            { collegeId: report.collegeId, fieldName: report.fieldName },
            { $set: { verificationStatus: 'Needs Review', confidenceScore: 30 } }
        );
    }

    return { report, updatedTrustScore: rep.trustScore };
}

module.exports = { hashIp, checkDuplicate, boostAnomalyScore, getOrCreateReputation, isWithinRateLimit, createVerificationTask, resolveReport };
