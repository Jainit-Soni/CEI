/**
 * models/AnomalyAlert.js — CEI Automated Anomaly Detection Record
 * ================================================================
 * Stores auto-generated alerts from the anomaly detection engine.
 * Every alert is linked to a VerificationTask for human follow-up.
 *
 * Designed for append-only write patterns. Status updates are allowed;
 * the original detection data (zScore, detectedValue, etc.) is immutable.
 */
const mongoose = require('mongoose');

const anomalyAlertSchema = new mongoose.Schema({
    // ── Identification ──────────────────────────────────────────────────────────
    alertRef: {
        type: String,
        unique: true,
        default: () => `ANM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    },

    // ── Target ──────────────────────────────────────────────────────────────────
    collegeId: { type: String, required: true, index: true },
    collegeName: { type: String },
    fieldName: { type: String, required: true },

    // ── Alert Classification ─────────────────────────────────────────────────────
    alertType: {
        type: String,
        required: true,
        enum: [
            'placement_spike',       // Sudden jump in avg/highest package
            'package_outlier',       // Z-score far from peer cluster
            'placement_rate_invalid',// Rate > 100% or avg > highest
            'campus_size_change',    // Sudden campus area change
            'faculty_anomaly',       // Faculty count statistical outlier
            'course_explosion',      // Course count spike without intake growth
            'accreditation_mismatch',// NAAC/AICTE data conflicts
            'yoy_jump',              // Year-on-year change beyond threshold
            'government_mismatch'    // Data conflicts with AISHE/UGC/AICTE
        ],
        index: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
        index: true
    },

    // ── Detection Data ───────────────────────────────────────────────────────────
    detectedValue: { type: mongoose.Schema.Types.Mixed }, // The flagged value
    expectedRange: {
        min: { type: Number, default: null },
        max: { type: Number, default: null },
        peerMedian: { type: Number, default: null }
    },
    zScore: { type: Number, default: null },
    yoyChangePct: { type: Number, default: null },  // Year-over-year % change
    peerCluster: { type: String, default: null },  // e.g. "Maharashtra_Engineering"
    description: { type: String, maxlength: 1000 },

    // ── Resolution ──────────────────────────────────────────────────────────────
    status: {
        type: String,
        enum: ['open', 'reviewing', 'resolved', 'dismissed'],
        default: 'open',
        index: true
    },
    verificationTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'VerificationTask', default: null },
    resolvedBy: { type: String, default: null },
    resolutionNote: { type: String, maxlength: 1000, default: null },
    resolvedAt: { type: Date, default: null },

    // ── Context ─────────────────────────────────────────────────────────────────
    scoringVersionId: { type: String, default: null },  // Version active at detection time
    scanRunId: { type: String, default: null },  // Groups all alerts from a single scan

    detectedAt: { type: Date, default: Date.now, index: true }

}, {
    collection: 'anomaly_alerts',
    versionKey: false
});

// Compound index for efficient full-scan review
anomalyAlertSchema.index({ status: 1, severity: -1, detectedAt: -1 });
anomalyAlertSchema.index({ collegeId: 1, alertType: 1 });

// Immutability on detection data
anomalyAlertSchema.pre(['updateOne', 'findOneAndUpdate'], async function (next) {
    const update = this.getUpdate();
    const IMMUTABLE = ['detectedValue', 'zScore', 'yoyChangePct', 'alertType', 'fieldName', 'collegeId', 'detectedAt'];
    const setFields = Object.keys(update?.$set || {});
    const illegal = setFields.filter(f => IMMUTABLE.includes(f));
    if (illegal.length > 0) {
        return next(new Error(`[AnomalyAlert] Immutable detection fields cannot be changed: ${illegal.join(', ')}`));
    }
    next();
});

module.exports = mongoose.model('AnomalyAlert', anomalyAlertSchema);
