/**
 * lib/incident.js — CEI Incident Framework
 * ==========================================
 * Lightweight incident recorder for critical system events.
 * Severity levels: S1 (governance compromise) → S4 (minor degradation)
 *
 * On S1/S2: writes AuditLog + fires webhook (if INCIDENT_WEBHOOK_URL set)
 * On S3/S4: writes structured log only
 *
 * Usage:
 *   const Incident = require('../lib/incident');
 *   await Incident.raise('S1', 'ScoringVersion activation failed', { versionId, reason });
 */

const logger = (() => { try { return require('./logger'); } catch { return console; } })();

const SEVERITY_LABELS = {
    S1: 'GOVERNANCE_COMPROMISE',
    S2: 'INTEGRITY_ANOMALY_SPIKE',
    S3: 'DATA_PIPELINE_INCONSISTENCY',
    S4: 'MINOR_API_DEGRADATION'
};

const SEVERITY_LOG_LEVEL = {
    S1: 'error',
    S2: 'error',
    S3: 'warn',
    S4: 'warn'
};

/**
 * Raise an incident.
 * @param {string} severity - S1 | S2 | S3 | S4
 * @param {string} title    - Short human-readable title
 * @param {object} context  - Arbitrary diagnostic data (no secrets)
 */
async function raise(severity, title, context = {}) {
    const label = SEVERITY_LABELS[severity] || 'UNKNOWN';
    const level = SEVERITY_LOG_LEVEL[severity] || 'warn';
    const incidentId = `INC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const ts = new Date().toISOString();

    // ── 1. Structured log ─────────────────────────────────────────────────────
    logger[level](`[Incident] ${severity} — ${title}`, {
        incidentId,
        severity,
        label,
        title,
        timestamp: ts,
        ...context
    });

    // ── 2. AuditLog (for S1 and S2 only — governance-level events) ───────────
    if (severity === 'S1' || severity === 'S2') {
        try {
            const AuditLog = require('../models/AuditLog');
            await AuditLog.create({
                event: 'SYNC_FAILED',    // Closest available event type for critical failures
                errorMessage: `[${incidentId}] ${severity} — ${title}`,
                errorStack: JSON.stringify(context),
                trigger: 'api',
                operator: 'incident_framework'
            });
        } catch (auditErr) {
            logger.error('[Incident] Failed to write AuditLog', { error: auditErr.message });
        }
    }

    // ── 3. Webhook (optional — set INCIDENT_WEBHOOK_URL in env) ──────────────
    const webhookUrl = process.env.INCIDENT_WEBHOOK_URL;
    if (webhookUrl && (severity === 'S1' || severity === 'S2')) {
        try {
            const fetch = globalThis.fetch || (await import('node-fetch')).default;
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    incidentId, severity, label, title, timestamp: ts,
                    // Strip any potentially sensitive fields before sending
                    context: sanitizeForWebhook(context)
                })
            });
        } catch (webhookErr) {
            logger.warn('[Incident] Webhook delivery failed', { url: '***', error: webhookErr.message });
        }
    }

    return { incidentId, severity, title, ts };
}

/**
 * Remove known sensitive keys before sending to external webhooks.
 */
function sanitizeForWebhook(obj) {
    const SENSITIVE = ['secret', 'token', 'password', 'key', 'auth', 'credential'];
    const result = {};
    for (const [k, v] of Object.entries(obj || {})) {
        const isSecret = SENSITIVE.some(s => k.toLowerCase().includes(s));
        result[k] = isSecret ? '[REDACTED]' : v;
    }
    return result;
}

module.exports = { raise, SEVERITY_LABELS };
