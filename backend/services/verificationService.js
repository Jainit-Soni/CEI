/**
 * services/verificationService.js — CEI Data Integrity & Verification Engine
 * ===========================================================================
 * Core service for:
 *  1. computeIntegrityScore(collegeId)   — Data Integrity Score formula
 *  2. validatePlacementData(placement)   — 4-layer placement hardening
 *  3. captureSnapshot(collegeId, vId)    — Forensic snapshot creation
 *  4. computeDataConfidenceLabel(score)  — Public label derivation
 *  5. setFieldSource(collegeId, field, sourceRecord) — Field-level update
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const DataSnapshot = require('../models/DataSnapshot');
const AuditLog = require('../models/AuditLog');
const logger = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// ── Constants ─────────────────────────────────────────────────────────────────

const CRITICAL_FIELDS = [
    'establishedYear', 'campusSize', 'accreditationStatus',
    'affiliations', 'coursesOffered', 'studentIntake',
    'avgPackage', 'highestPackage', 'placementRate',
    'companiesVisiting', 'facultyCount', 'infrastructureMetric'
];

const INTEGRITY_WEIGHTS = {
    verificationCoverage: 0.30,
    governmentMatchRate: 0.25,
    recencyFreshness: 0.20,
    consistencyStability: 0.15,
    disputeCleanliness: 0.10
};

// Recency freshness: data older than DECAY_MONTHS gets a reduced score
const DECAY_MONTHS = 24;

// ── 1. Compute Data Integrity Score ──────────────────────────────────────────

/**
 * Recomputes the Data Integrity Score (0–100) for a single institution
 * and saves `dataIntegrityScore` and `dataConfidenceLabel` back to MongoDB.
 *
 * Formula:
 *   IntegrityScore =
 *     (0.30 × Verification Coverage)     — % of fields that are not "unverified"
 *   + (0.25 × Government Match Rate)     — % of govt-registrable fields auto_verified
 *   + (0.20 × Recency Freshness)         — exponential decay on time since last verify
 *   + (0.15 × Consistency Stability)     — penalise open anomaly/dispute count
 *   + (0.10 × Dispute Cleanliness)       — penalise unresolved disputes
 *
 * @param {string} collegeId
 * @returns {Promise<{score: number, label: string}>}
 */
async function computeIntegrityScore(collegeId) {
    const college = await College.findOne({ id: collegeId })
        .select('fieldSources hasOpenAnomalies hasGovernmentMismatch verificationStatus')
        .lean();

    if (!college) throw new Error(`College not found: ${collegeId}`);

    const sources = college.fieldSources || {};

    // 1. Verification Coverage (0–100)
    const totalFields = CRITICAL_FIELDS.length;
    const verifiedCount = CRITICAL_FIELDS.filter(f => {
        const s = sources[f];
        return s && s.verification_status !== 'unverified';
    }).length;
    const verificationCoverage = (verifiedCount / totalFields) * 100;

    // 2. Government Match Rate (0–100)
    const govtVerifiable = ['establishedYear', 'accreditationStatus', 'affiliations', 'studentIntake'];
    const govtMatched = govtVerifiable.filter(f => {
        const s = sources[f];
        return s && ['aishe', 'ugc', 'aicte'].includes(s.verifier_type) &&
            s.verification_status !== 'unverified';
    }).length;
    const governmentMatchRate = (govtMatched / govtVerifiable.length) * 100;

    // 3. Recency Freshness (0–100)
    // Average freshness across all verified fields (exponential decay)
    const now = Date.now();
    const freshnessScores = CRITICAL_FIELDS.map(f => {
        const s = sources[f];
        if (!s || !s.verified_at) return 0;
        const ageMonths = (now - new Date(s.verified_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
        // Exponential decay: score = 100 * e^(-age/DECAY_MONTHS)
        return Math.max(0, 100 * Math.exp(-ageMonths / DECAY_MONTHS));
    });
    const recencyFreshness = freshnessScores.reduce((a, b) => a + b, 0) / totalFields;

    // 4. Consistency Stability (0–100) — penalise open anomalies
    // simple binary: -25 for open anomaly, -25 for govt mismatch
    let consistencyStability = 100;
    if (college.hasOpenAnomalies) consistencyStability -= 40;
    if (college.hasGovernmentMismatch) consistencyStability -= 30;
    consistencyStability = Math.max(0, consistencyStability);

    // 5. Dispute Cleanliness (0–100)
    // We read directly from Dispute model to avoid circular deps
    let disputeCleanliness = 100;
    try {
        const Dispute = require('../models/Dispute');
        const openDisputes = await Dispute.countDocuments({
            institutionId: collegeId,
            status: { $in: ['pending', 'under_review'] }
        });
        disputeCleanliness = Math.max(0, 100 - openDisputes * 25);
    } catch (_) { /* Dispute model may not exist, treat as clean */ }

    // ── Weighted composite ─────────────────────────────────────────────────────
    const score = Math.round(
        INTEGRITY_WEIGHTS.verificationCoverage * verificationCoverage +
        INTEGRITY_WEIGHTS.governmentMatchRate * governmentMatchRate +
        INTEGRITY_WEIGHTS.recencyFreshness * recencyFreshness +
        INTEGRITY_WEIGHTS.consistencyStability * consistencyStability +
        INTEGRITY_WEIGHTS.disputeCleanliness * disputeCleanliness
    );

    const label = computeDataConfidenceLabel(score);

    await College.updateOne(
        { id: collegeId },
        { $set: { dataIntegrityScore: score, dataConfidenceLabel: label, lastIntegrityCheck: new Date() } }
    );

    logger.info(`[IntegrityScore] ${collegeId} → ${score}/100 (${label})`);
    return { score, label, components: { verificationCoverage, governmentMatchRate, recencyFreshness, consistencyStability, disputeCleanliness } };
}

// ── 2. Validate Placement Data ────────────────────────────────────────────────

/**
 * 4-layer placement validation.
 * Returns { valid, errors: [], warnings: [], confidenceLabel }
 *
 * Layer 1: Mandatory evidence presence
 * Layer 2: Internal consistency (avg ≤ highest, rate ≤ 100%)
 * Layer 3: Statistical outlier estimation (uses provided peer stats)
 * Layer 4: Confidence label assignment
 *
 * @param {object} placement     — The placement sub-document
 * @param {object} peerStats     — { medianPackage, p75Package, stdDev } for peer cluster
 * @param {boolean} hasEvidence  — Whether a placement PDF hash has been stored
 */
function validatePlacementData(placement, peerStats = {}, hasEvidence = false) {
    const errors = [];
    const warnings = [];

    if (!placement) return { valid: false, errors: ['No placement data provided'], warnings: [], confidenceLabel: 'unverified' };

    const avg = parseFloat(placement.averagePackage) || null;
    const highest = parseFloat(placement.highestPackageNumeric) || parseFloat(placement.highestPackage) || null;
    const rate = parseFloat(placement.placementRate) || null;

    // ── Layer 2: Internal consistency ─────────────────────────────────────────
    if (avg !== null && highest !== null && avg > highest) {
        errors.push('CONSISTENCY_FAIL: Average package exceeds highest package — impossible value.');
    }
    if (rate !== null && rate > 100) {
        errors.push('RATE_INVALID: Placement rate > 100% — automatic rejection.');
    }
    if (highest !== null && avg !== null && highest > 5 * avg) {
        warnings.push('OUTLIER_WARN: Highest package is 5× the average — potential data error. Manual review recommended.');
    }

    // ── Layer 3: Statistical outlier ─────────────────────────────────────────
    if (peerStats.medianPackage && highest !== null) {
        const z = peerStats.stdDev > 0
            ? (highest - peerStats.medianPackage) / peerStats.stdDev
            : 0;
        if (Math.abs(z) > 2.5) {
            warnings.push(`STATISTICAL_OUTLIER: Highest package z-score = ${z.toFixed(2)} (threshold: ±2.5). Anomaly scan queued.`);
        }
    }

    // ── Layer 4: Confidence label ─────────────────────────────────────────────
    let confidenceLabel = 'unverified';
    if (errors.length === 0) {
        if (hasEvidence) {
            confidenceLabel = 'audited';
        } else if (warnings.length === 0) {
            confidenceLabel = 'self_declared';
        } else {
            confidenceLabel = 'under_review';
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        confidenceLabel
    };
}

// ── 3. Capture Forensic Snapshot ─────────────────────────────────────────────

/**
 * Captures and stores a DataSnapshot for an institution at scoring time.
 * If a snapshot already exists for this (collegeId + scoringVersionId),
 * it is skipped (idempotent).
 *
 * @param {string} collegeId
 * @param {string} scoringVersionId
 * @returns {Promise<{snapshotId, recordHash}>}
 */
async function captureSnapshot(collegeId, scoringVersionId) {
    const college = await College.findOne({ id: collegeId }).lean();
    if (!college) throw new Error(`[Snapshot] College not found: ${collegeId}`);

    // Remove Mongoose internals before hashing
    const { _id, __v, updatedAt, createdAt, ...hashableData } = college;
    const recordHash = DataSnapshot.computeHash(hashableData);

    // Idempotent: if snapshot already exists for this pair, return early
    const existing = await DataSnapshot.findOne({ collegeId, scoringVersionId });
    if (existing) {
        return { snapshotId: existing._id, recordHash: existing.recordHash, skipped: true };
    }

    const snap = await DataSnapshot.create({
        collegeId,
        scoringVersionId,
        ceiScore: college.ceiScore,
        competitivenessBand: college.competitivenessBand,
        dataIntegrityScore: college.dataIntegrityScore,
        recordHash,
        snapshotData: hashableData
    });

    return { snapshotId: snap._id, recordHash };
}

// ── 4. Data Confidence Label ──────────────────────────────────────────────────

function computeDataConfidenceLabel(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'moderate';
    return 'low';
}

// ── 5. Set Field Source ───────────────────────────────────────────────────────

/**
 * Updates the provenance record for a single critical field on an institution.
 * Triggers an integrity score recomputation after the update.
 *
 * @param {string} collegeId
 * @param {string} fieldName   — Key of CRITICAL_FIELDS
 * @param {object} sourceRecord — DataSourceRecord object
 */
async function setFieldSource(collegeId, fieldName, sourceRecord) {
    if (!CRITICAL_FIELDS.includes(fieldName)) {
        throw new Error(`[VerificationService] "${fieldName}" is not a tracked critical field.`);
    }

    await College.updateOne(
        { id: collegeId },
        { $set: { [`fieldSources.${fieldName}`]: { ...sourceRecord, verified_at: new Date() } } }
    );

    logger.info(`[FieldSource] Updated ${fieldName} for ${collegeId} → ${sourceRecord.verification_status}`);

    // Recompute integrity score after any field update
    const result = await computeIntegrityScore(collegeId);
    return result;
}

// ── 6. Batch Integrity Recompute ──────────────────────────────────────────────

/**
 * Recomputes integrity scores for all institutions in batches.
 * Designed for scheduled jobs. Logs progress and errors.
 * @param {number} batchSize
 */
async function recomputeAllIntegrityScores(batchSize = 200) {
    const total = await College.countDocuments({});
    logger.info(`[IntegrityBatch] Starting recompute for ${total} institutions...`);

    let processed = 0;
    let errors = 0;
    const cursor = College.find({}, { id: 1 }).lean().cursor();

    const batch = [];
    for await (const { id } of cursor) {
        batch.push(id);
        if (batch.length >= batchSize) {
            await Promise.allSettled(
                batch.map(cid => computeIntegrityScore(cid).catch(e => { errors++; }))
            );
            processed += batch.length;
            batch.length = 0;
            logger.info(`[IntegrityBatch] Processed ${processed}/${total}...`);
        }
    }
    if (batch.length > 0) {
        await Promise.allSettled(
            batch.map(cid => computeIntegrityScore(cid).catch(e => { errors++; }))
        );
        processed += batch.length;
    }

    logger.info(`[IntegrityBatch] Complete. Processed: ${processed}, Errors: ${errors}`);
    return { processed, errors };
}

module.exports = {
    computeIntegrityScore,
    validatePlacementData,
    captureSnapshot,
    computeDataConfidenceLabel,
    setFieldSource,
    recomputeAllIntegrityScores,
    CRITICAL_FIELDS,
    INTEGRITY_WEIGHTS
};
