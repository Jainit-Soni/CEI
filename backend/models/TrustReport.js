/**
 * models/TrustReport.js — CEI Public Trust Reporting System (Phase XVI)
 * =====================================================================
 * A community-submitted report of incorrect or suspicious college data.
 * Each report triggers duplicate checks and boosts the anomaly weight for the field.
 */

const mongoose = require('mongoose');

const TrustReportSchema = new mongoose.Schema({
    // ── Target ─────────────────────────────────────────────────────────────────
    collegeId: { type: String, required: true, index: true },
    fieldName: { type: String, required: true },
    reportedValue: { type: mongoose.Schema.Types.Mixed, required: true }, // What the reporter believes is the truth
    evidenceURL: { type: String, maxlength: 2000, default: null },
    reportReason: { type: String, required: true, maxlength: 1000 },

    // ── Reporter Identity ──────────────────────────────────────────────────────
    reporterId: { type: String, default: null },      // Firebase UID if logged in
    reporterIpHash: { type: String, required: true },     // SHA-256 of IP (for anon rate-limit)
    reporterTrustScore: { type: Number, default: 50 },        // snapshotted at time of submission

    // ── Processing State ───────────────────────────────────────────────────────
    status: {
        type: String,
        enum: ['pending', 'validated', 'rejected', 'duplicate'],
        default: 'pending',
        index: true
    },
    isDuplicate: { type: Boolean, default: false },
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'TrustReport', default: null },

    // ── Anomaly Boost Applied ─────────────────────────────────────────────────
    anomalyScoreBoost: { type: Number, default: 5 }, // default +5 weight boost per report

    // ── Linked VerificationTask ────────────────────────────────────────────────
    verificationTaskRef: { type: String, default: null },

    // ── Admin Review ──────────────────────────────────────────────────────────
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, maxlength: 1000, default: null }

}, {
    collection: 'trust_reports',
    timestamps: true,
    versionKey: false
});

TrustReportSchema.index({ collegeId: 1, fieldName: 1, status: 1 });
TrustReportSchema.index({ reporterIpHash: 1, createdAt: -1 }); // for rate limiting

module.exports = mongoose.models.TrustReport ||
    mongoose.model('TrustReport', TrustReportSchema);
