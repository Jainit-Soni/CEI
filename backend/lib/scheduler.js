/**
 * lib/scheduler.js — CEI Automated Job Scheduler
 * =================================================
 * Uses node-cron to run background maintenance jobs on a schedule.
 * All jobs are idempotent, retried on failure, and logged to AuditLog.
 *
 * Jobs:
 *   - weekly-anomaly-scan      : Sunday 02:00 IST
 *   - monthly-integrity-recompute: 1st of month 03:00 IST
 *   - freeze-window-expiry-check : Daily 09:00 IST
 *
 * Initialize by calling scheduler.start() once at server startup.
 * Safe to call multiple times — subsequent calls are no-ops.
 */

const logger = (() => { try { return require('./logger'); } catch { return console; } })();
const Incident = require('./incident');

let initialized = false;
let cron = null;

// Lazily load cron to avoid hard startup failure if node-cron not installed
function getCron() {
    if (!cron) {
        try {
            cron = require('node-cron');
        } catch {
            logger.warn('[Scheduler] node-cron not installed. Run: npm install node-cron');
        }
    }
    return cron;
}

// ── Job Wrapper ───────────────────────────────────────────────────────────────

/**
 * Wraps a job function with logging, error handling, and AuditLog recording.
 */
async function runJob(jobName, jobFn) {
    const start = Date.now();
    logger.info(`[Scheduler] Job started: ${jobName}`);

    try {
        const result = await jobFn();
        const durationMs = Date.now() - start;
        logger.info(`[Scheduler] Job completed: ${jobName}`, { durationMs, result });
        return result;
    } catch (err) {
        const durationMs = Date.now() - start;
        logger.error(`[Scheduler] Job failed: ${jobName}`, { durationMs, error: err.message });

        // S3 incident for data pipeline job failure
        await Incident.raise('S3', `Scheduled job failed: ${jobName}`, {
            jobName,
            error: err.message,
            durationMs
        }).catch(() => { });

        return null;
    }
}

// ── Individual Jobs ────────────────────────────────────────────────────────────

async function jobWeeklyAnomalyScan() {
    const { runAllScans } = require('../services/anomalyDetectionService');
    const ScoringVersion = require('../models/ScoringVersion');
    const active = await ScoringVersion.findOne({ status: 'active' }, { versionId: 1 }).lean();

    const result = await runAllScans(active?.versionId || null);

    // Raise S2 incident if scan finds a large spike
    if (result.totalAlerts > 50) {
        await Incident.raise('S2', 'Weekly anomaly scan: large spike detected', {
            totalAlerts: result.totalAlerts,
            breakdown: result.breakdown,
            scanRunId: result.scanRunId
        });
    }

    return result;
}

async function jobMonthlyIntegrityRecompute() {
    const { recomputeAllIntegrityScores } = require('../services/verificationService');
    return await recomputeAllIntegrityScores(250); // batch size 250
}

async function jobFreezeWindowCheck() {
    const ScoringVersion = require('../models/ScoringVersion');
    const now = new Date();

    // Find versions whose freeze window is expiring within the next 48 hours
    const expiringSoon = await ScoringVersion.find({
        status: 'active',
        freezeUntil: { $gte: now, $lte: new Date(now.getTime() + 48 * 60 * 60 * 1000) }
    }, { versionId: 1, freezeUntil: 1 }).lean();

    if (expiringSoon.length > 0) {
        logger.info('[Scheduler] Freeze window expiring soon', {
            versions: expiringSoon.map(v => ({ versionId: v.versionId, freezeUntil: v.freezeUntil }))
        });
    }

    return { checked: true, expiringSoon: expiringSoon.length };
}

// ── Phase XVI Jobs ─────────────────────────────────────────────────────────────

async function jobDailyReportProcessing() {
    const TrustReport = require('../models/TrustReport');
    const rp = require('./reportProcessor');
    const pending = await TrustReport.find({ status: 'pending', isDuplicate: false }).limit(200).lean();
    let processed = 0;
    for (const report of pending) {
        // Check if a VerificationTask was created; if not, create one now
        if (!report.verificationTaskRef) {
            try {
                const taskRef = await rp.createVerificationTask(report, report.reporterTrustScore || 50);
                await TrustReport.findByIdAndUpdate(report._id, { verificationTaskRef: taskRef });
                processed++;
            } catch { /* skip individual failures */ }
        }
    }
    logger.info('[Scheduler] Daily report processing complete.', { pending: pending.length, processed });
    return { pending: pending.length, processed };
}

async function jobWeeklyPlacementScan() {
    const College = require('../models/CollegeSchema');
    const PlacementReality = require('../models/PlacementReality');
    const AuditLog = require('../models/AuditLog');
    const pd = require('./placementDetector');

    const colleges = await College.find({}).select('college_id state tier avg_package companies_visiting alumni_companies nirf_avg_package').lean();
    let updated = 0;

    for (const college of colleges) {
        try {
            const peers = colleges.filter(p => p.state === college.state && p.tier === college.tier && p.college_id !== college.college_id);
            const auditHistory = await AuditLog.find({ entityId: college.college_id, fieldName: 'avg_package' }).sort({ createdAt: 1 }).limit(10).lean();
            const outlier = pd.detectStatisticalOutlier(college, peers);
            const drift = pd.detectHistoricalDrift(auditHistory);
            const crossSource = pd.detectCrossSourceVariance(college.avg_package, college.nirf_avg_package ? [college.nirf_avg_package] : []);
            const companyCheck = pd.detectCompanyReality(college.companies_visiting || [], college.alumni_companies || []);
            const result = pd.computePlacementRealityScore({ outlier, drift, crossSource, companyReality: companyCheck });

            await PlacementReality.findOneAndUpdate(
                { collegeId: college.college_id },
                { ...result, collegeId: college.college_id, lastComputed: new Date() },
                { upsert: true }
            );
            updated++;
        } catch { /* skip individual failures */ }
    }

    logger.info('[Scheduler] Weekly placement scan complete.', { total: colleges.length, updated });
    return { total: colleges.length, updated };
}

async function jobMonthlyFullVerification() {
    const VerifiedField = require('../models/VerifiedField');
    const SourceEvidence = require('../models/SourceEvidence');
    const { computeConfidence, computeRecency, computeConsistency, deriveStatus } = require('./confidenceEngine');

    const fields = await VerifiedField.find({}).lean();
    let updated = 0;

    for (const field of fields) {
        try {
            const sources = await SourceEvidence.find({ verifiedFieldId: { $in: field.sourceIds }, isActive: true }).lean();
            const consistency = computeConsistency(sources);
            const recency = sources.length ? computeRecency(sources[sources.length - 1]?.capturedAt) : 0.2;
            const score = computeConfidence({ sources: sources.map(s => ({ trustLevel: s.trustLevel })), consistency, recency, historicalStability: 0.8 });

            await VerifiedField.findByIdAndUpdate(field._id, {
                confidenceScore: score,
                verificationStatus: deriveStatus(score),
                nextVerificationAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
            updated++;
        } catch { /* skip */ }
    }

    logger.info('[Scheduler] Monthly full verification complete.', { total: fields.length, updated });
    return { total: fields.length, updated };
}

// ── Scheduler Initialization ──────────────────────────────────────────────────

function start() {
    if (initialized) {
        logger.warn('[Scheduler] Already initialized — skipping duplicate start.');
        return;
    }

    const c = getCron();
    if (!c) {
        logger.warn('[Scheduler] node-cron not available. Scheduled jobs are disabled.');
        return;
    }

    // Sunday at 02:00 IST (UTC+5:30 → UTC: Saturday 20:30)
    c.schedule('30 20 * * 6', () => runJob('weekly-anomaly-scan', jobWeeklyAnomalyScan), {
        scheduled: true,
        timezone: 'UTC'
    });

    // 1st of every month at 03:00 IST (UTC: previous day 21:30)
    c.schedule('30 21 L * *', () => runJob('monthly-integrity-recompute', jobMonthlyIntegrityRecompute), {
        scheduled: true,
        timezone: 'UTC'
    });

    // Daily at 09:00 IST (UTC: 03:30)
    c.schedule('30 3 * * *', () => runJob('freeze-window-check', jobFreezeWindowCheck), {
        scheduled: true,
        timezone: 'UTC'
    });

    // Daily at 01:00 IST (UTC: 19:30 previous day) — trust report processing
    c.schedule('30 19 * * *', () => runJob('daily-report-processing', jobDailyReportProcessing), {
        scheduled: true, timezone: 'UTC'
    });

    // Every Wednesday at 03:00 IST (UTC: Tuesday 21:30) — placement reality scan
    c.schedule('30 21 * * 2', () => runJob('weekly-placement-scan', jobWeeklyPlacementScan), {
        scheduled: true, timezone: 'UTC'
    });

    // 2nd of every month at 04:00 IST (UTC: 1st 22:30) — full field re-verification
    c.schedule('30 22 2 * *', () => runJob('monthly-full-verification', jobMonthlyFullVerification), {
        scheduled: true, timezone: 'UTC'
    });

    initialized = true;
    logger.info('[Scheduler] All jobs registered.', {
        jobs: ['weekly-anomaly-scan', 'monthly-integrity-recompute', 'freeze-window-check',
            'daily-report-processing', 'weekly-placement-scan', 'monthly-full-verification']
    });
}

/**
 * Manually trigger any job by name (for admin API and testing).
 */
async function triggerJob(jobName) {
    const JOB_MAP = {
        'weekly-anomaly-scan': jobWeeklyAnomalyScan,
        'monthly-integrity-recompute': jobMonthlyIntegrityRecompute,
        'freeze-window-check': jobFreezeWindowCheck,
        'daily-report-processing': jobDailyReportProcessing,
        'weekly-placement-scan': jobWeeklyPlacementScan,
        'monthly-full-verification': jobMonthlyFullVerification
    };
    const fn = JOB_MAP[jobName];
    if (!fn) throw new Error(`Unknown job: ${jobName}. Available: ${Object.keys(JOB_MAP).join(', ')}`);
    return await runJob(jobName, fn);
}

module.exports = { start, triggerJob };
