/**
 * models/VerifiedField.js — CEI National Data Verification Engine (Phase XVI)
 * ============================================================================
 * Stores the verified state of one critical data field for one institution.
 * Every change to a VerifiedField is immutable in the AuditLog.
 *
 * Confidence Score Mapping:
 *   90–100 → Verified
 *   70–89  → Likely Accurate
 *   40–69  → Needs Review
 *   0–39   → Untrusted
 */

const mongoose = require('mongoose');

const VERIFIABLE_FIELDS = [
    'established_year', 'campus_size', 'courses_offered', 'accreditation',
    'student_intake', 'faculty_count', 'placement_rate', 'avg_package',
    'highest_package', 'companies_visiting', 'hostel_capacity', 'ownership_type'
];

const VerifiedFieldSchema = new mongoose.Schema({
    // ── Identity ───────────────────────────────────────────────────────────────
    collegeId: { type: String, required: true, index: true },
    fieldName: { type: String, required: true, enum: VERIFIABLE_FIELDS, index: true },

    // ── Current Best Value ─────────────────────────────────────────────────────
    fieldValue: { type: mongoose.Schema.Types.Mixed, default: null },

    // ── Confidence ─────────────────────────────────────────────────────────────
    confidenceScore: {
        type: Number, min: 0, max: 100, default: 0, index: true
    },
    verificationStatus: {
        type: String,
        enum: ['Verified', 'Likely Accurate', 'Needs Review', 'Untrusted'],
        default: 'Untrusted',
        index: true
    },

    // ── Source IDs (SourceEvidence._id refs) ───────────────────────────────────
    sourceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SourceEvidence' }],
    sourceCount: { type: Number, default: 0 },

    // ── Anomaly Boost (from TrustReports) ─────────────────────────────────────
    anomalyBoost: { type: Number, default: 0 }, // each pending report adds weight

    // ── Lifecycle ──────────────────────────────────────────────────────────────
    lastVerifiedAt: { type: Date, default: null },
    nextVerificationAt: { type: Date, default: null },

    // ── Linked VerificationTask ────────────────────────────────────────────────
    activeTaskRef: { type: String, default: null }

}, {
    collection: 'verified_fields',
    timestamps: true,
    versionKey: false
});

// Compound index for fast per-college field queries
VerifiedFieldSchema.index({ collegeId: 1, fieldName: 1 }, { unique: true });
VerifiedFieldSchema.index({ verificationStatus: 1, confidenceScore: 1 });

// ── Status Derivation Helper ───────────────────────────────────────────────────
VerifiedFieldSchema.methods.deriveStatus = function () {
    const s = this.confidenceScore;
    if (s >= 90) return 'Verified';
    if (s >= 70) return 'Likely Accurate';
    if (s >= 40) return 'Needs Review';
    return 'Untrusted';
};

VerifiedFieldSchema.pre('save', function (next) {
    this.verificationStatus = this.deriveStatus();
    this.sourceCount = this.sourceIds?.length || 0;
    next();
});

module.exports = mongoose.models.VerifiedField ||
    mongoose.model('VerifiedField', VerifiedFieldSchema);
