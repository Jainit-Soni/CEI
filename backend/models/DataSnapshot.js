/**
 * models/DataSnapshot.js — CEI Forensic Data Snapshot
 * =====================================================
 * Captures the full data state of an institution at the moment it is scored.
 * Stored immutably so that any future score change can be traced to the exact
 * data that produced it. Linked to a ScoringVersion.
 *
 * SECURITY: Records are append-only. The pre-update guard prevents tampering.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');

const dataSnapshotSchema = new mongoose.Schema({
    // ── Identification ──────────────────────────────────────────────────────────
    collegeId: {
        type: String,
        required: true,
        index: true
    },
    scoringVersionId: {
        type: String,
        required: true,
        index: true
    },

    // ── Score at capture time ───────────────────────────────────────────────────
    ceiScore: { type: Number, default: null },
    competitivenessBand: { type: String, default: null },
    dataIntegrityScore: { type: Number, default: null },

    // ── Forensic Hash ───────────────────────────────────────────────────────────
    // SHA-256 of the entire snapshotData JSON, computed at creation time.
    // Any future data change will produce a different hash — proving data drift.
    recordHash: {
        type: String,
        required: true,
        index: true
    },

    // ── Full record snapshot ────────────────────────────────────────────────────
    // The complete MongoDB document as it existed at scoring time.
    // This is what produced the ceiScore above.
    snapshotData: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },

    capturedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    collection: 'data_snapshots',
    versionKey: false
});

// Compound index: fast lookup of "what data existed for institution X at version Y"
dataSnapshotSchema.index({ collegeId: 1, scoringVersionId: 1 }, { unique: true });

// IMMUTABILITY GUARD
dataSnapshotSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function (next) {
    const err = new Error('[DataSnapshot] Snapshot records are immutable. They cannot be updated after creation.');
    err.status = 403;
    next(err);
});

/**
 * Static helper to compute the SHA-256 record hash from a plain object.
 * Usage: DataSnapshot.computeHash(collegeDoc)
 */
dataSnapshotSchema.statics.computeHash = function (obj) {
    const canonical = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex');
};

module.exports = mongoose.model('DataSnapshot', dataSnapshotSchema);
