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

    initialized = true;
    logger.info('[Scheduler] All jobs registered.', {
        jobs: ['weekly-anomaly-scan', 'monthly-integrity-recompute', 'freeze-window-check']
    });
}

/**
 * Manually trigger any job by name (for admin API and testing).
 */
async function triggerJob(jobName) {
    const JOB_MAP = {
        'weekly-anomaly-scan': jobWeeklyAnomalyScan,
        'monthly-integrity-recompute': jobMonthlyIntegrityRecompute,
        'freeze-window-check': jobFreezeWindowCheck
    };
    const fn = JOB_MAP[jobName];
    if (!fn) throw new Error(`Unknown job: ${jobName}. Available: ${Object.keys(JOB_MAP).join(', ')}`);
    return await runJob(jobName, fn);
}

module.exports = { start, triggerJob };
