/**
 * models/VerificationTask.js — CEI Human Verification Workflow
 * =============================================================
 * Tracks the lifecycle of a data field through the human review pipeline.
 *
 * Status Flow: pending → under_review → verified | rejected → archived
 *
 * All status transitions and reviewer actions are appended-only to reviewHistory.
 * No silent edits are possible — every change is logged.
 */
const mongoose = require('mongoose');

const reviewHistorySchema = new mongoose.Schema({
    status: { type: String, required: true },
    action: { type: String, required: true },  // e.g., "submitted_evidence", "approved"
    note: { type: String, maxlength: 2000 },
    performedBy: { type: String, required: true },
    performedAt: { type: Date, default: Date.now }
}, { _id: false });

const verificationTaskSchema = new mongoose.Schema({
    // ── Identification ──────────────────────────────────────────────────────────
    taskRef: {
        type: String,
        unique: true,
        default: () => `VT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    },

    // ── Institution & Field ─────────────────────────────────────────────────────
    collegeId: { type: String, required: true, index: true },
    collegeName: { type: String, maxlength: 300 },
    fieldName: {
        type: String,
        required: true,
        enum: [
            'establishedYear', 'campusSize', 'accreditationStatus', 'affiliations',
            'coursesOffered', 'studentIntake', 'avgPackage', 'highestPackage',
            'placementRate', 'companiesVisiting', 'facultyCount', 'infrastructureMetric',
            'naacGrade', 'approvalStatus', 'other'
        ]
    },

    // ── Task Origin ─────────────────────────────────────────────────────────────
    source: {
        type: String,
        enum: ['anomaly_scanner', 'dispute', 'admin_flag', 'government_mismatch', 'manual'],
        default: 'manual',
        index: true
    },
    sourceRef: { type: String, default: null }, // e.g., anomalyAlertId or disputeRef

    // ── Lifecycle ───────────────────────────────────────────────────────────────
    status: {
        type: String,
        enum: ['pending', 'under_review', 'verified', 'rejected', 'archived'],
        default: 'pending',
        index: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
        index: true
    },

    // ── Evidence & Review ───────────────────────────────────────────────────────
    currentValue: { type: mongoose.Schema.Types.Mixed, default: null },
    proposedValue: { type: mongoose.Schema.Types.Mixed, default: null },
    evidenceUrls: [{ type: String, maxlength: 500 }],
    documentHashes: [{ type: String }],  // SHA-256 hashes of uploaded evidence files
    reviewerNotes: { type: String, maxlength: 2000, default: null },

    // ── Approval Gate ───────────────────────────────────────────────────────────
    requiresSupervisorApproval: { type: Boolean, default: false },
    supervisorApprovedBy: { type: String, default: null },
    supervisorApprovedAt: { type: Date, default: null },

    // ── Immutable History ───────────────────────────────────────────────────────
    reviewHistory: [reviewHistorySchema],

    // ── Timestamps ─────────────────────────────────────────────────────────────
    assignedTo: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    dueDate: { type: Date, default: null }

}, {
    collection: 'verification_tasks',
    timestamps: true,
    versionKey: false
});

// Indexes for efficient queue queries
verificationTaskSchema.index({ status: 1, priority: -1, createdAt: 1 });
verificationTaskSchema.index({ collegeId: 1, fieldName: 1 });

module.exports = mongoose.model('VerificationTask', verificationTaskSchema);
