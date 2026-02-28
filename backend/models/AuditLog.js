/**
 * models/AuditLog.js
 *
 * Immutable audit log for all scoring sync operations.
 * Records are append-only (no update/delete allowed via schema middleware).
 */
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    // What operation was performed
    event: {
        type: String,
        enum: ['SYNC_START', 'SYNC_COMPLETE', 'SYNC_FAILED', 'SYNC_ROLLBACK', 'CACHE_INVALIDATE', 'SCORE_VERIFY_PASS', 'SCORE_VERIFY_FAIL'],
        required: true,
        index: true
    },

    // Scoring engine provenance
    engineVersion: { type: String },
    inputHash: { type: String },   // SHA-256 of the CSV input file
    outputHash: { type: String },   // SHA-256 of the scored CSV output

    // Sync statistics
    totalRecords: { type: Number, default: 0 },
    updatedRecords: { type: Number, default: 0 },
    failedRecords: { type: Number, default: 0 },
    skippedRecords: { type: Number, default: 0 },

    // Dataset fingerprint for diff-based change detection
    bandDistribution: {
        Elite: Number,
        High: Number,
        Competitive: Number,
        Moderate: Number,
        Emerging: Number
    },

    // Error context if applicable
    errorMessage: { type: String },
    errorStack: { type: String },

    // Operator / trigger context
    trigger: { type: String, enum: ['manual', 'scheduled', 'api'], default: 'manual' },
    operator: { type: String, default: 'system' },
    durationMs: { type: Number },

    createdAt: { type: Date, default: Date.now, index: true }
}, {
    collection: 'audit_logs',
    versionKey: false
});

// IMMUTABILITY GUARD: Never allow an existing log record to be updated
auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function (next) {
    const err = new Error('[AuditLog] Audit records are immutable and cannot be updated.');
    err.status = 403;
    next(err);
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
