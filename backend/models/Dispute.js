/**
 * models/Dispute.js — CEI Dispute Governance Model
 * ==================================================
 * Append-only institutional dispute records.
 * Disputes cannot auto-change scores — they require a new ScoringVersion
 * if the resolution is structural. All disputes are permanently logged.
 *
 * PUBLIC COMMITMENT:
 *   Disputes protect against backdoor adjustments.
 *   No score can be manually altered without creating a traceable,
 *   version-linked audit record visible through the transparency API.
 */
const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
    // ── Identification ───────────────────────────────────────────────────────
    disputeRef: {
        type: String,
        unique: true,
        default: () => `DSP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    },

    // ── Institution ──────────────────────────────────────────────────────────
    institutionId: {
        type: String,
        index: true,
        default: null
    },
    institutionName: {
        type: String,
        maxlength: 300,
        required: true
    },
    scoringVersionId: {
        type: String,
        index: true,
        required: true  // Must reference the specific version being disputed
    },
    ceiScoreAtDispute: {
        type: Number,
        default: null   // Snapshot of score when dispute was filed
    },
    bandAtDispute: {
        type: String,
        default: null
    },

    // ── Claim ────────────────────────────────────────────────────────────────
    claimType: {
        type: String,
        required: true,
        enum: [
            'incorrect_score',       // Score doesn't match expected based on public data
            'wrong_band',            // Placed in wrong competitiveness band
            'missing_data',          // Key data (NAAC grade, est. year) not reflected
            'grace_protocol_issue',  // Elite institution incorrectly processed
            'data_corruption',       // Believes underlying dataset is corrupted
            'other'
        ]
    },
    description: {
        type: String,
        required: true,
        minlength: 20,
        maxlength: 3000
    },
    evidenceLinks: [{
        type: String,
        maxlength: 500
    }],

    // ── Submitter ────────────────────────────────────────────────────────────
    submittedBy: {
        type: String,
        maxlength: 200,
        default: 'anonymous'
    },
    contactEmail: {
        type: String,
        maxlength: 200,
        default: null
    },

    // ── Governance Lifecycle ─────────────────────────────────────────────────
    status: {
        type: String,
        enum: ['pending', 'under_review', 'resolved', 'rejected', 'escalated'],
        default: 'pending',
        index: true
    },
    reviewedBy: { type: String, default: null },
    resolutionNote: {
        type: String,
        maxlength: 2000,
        default: null
    },
    resolvedScoringVersionId: {
        type: String,
        default: null   // If resolved with a structural change, links to new version
    },
    isPublic: {
        type: Boolean,
        default: true   // Anonymized disputes visible publicly
    },

    // ── Timestamps ───────────────────────────────────────────────────────────
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null }
}, {
    collection: 'disputes',
    versionKey: false
});

// Auto-update updatedAt on save — disputes ARE updateable (status/resolution)
// but the original claim (description, claimType, submittedBy) is immutable

disputeSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Block modification of original claim fields after creation
disputeSchema.pre(['updateOne', 'findOneAndUpdate'], async function (next) {
    const update = this.getUpdate();
    const CLAIM_FIELDS = ['description', 'claimType', 'institutionId', 'institutionName',
        'submittedBy', 'contactEmail', 'scoringVersionId', 'ceiScoreAtDispute', 'evidenceLinks'];
    const setFields = Object.keys(update?.$set || {});
    const illegal = setFields.filter(f => CLAIM_FIELDS.includes(f));

    if (illegal.length > 0) {
        const err = new Error(
            `[Dispute] Original claim fields are immutable: ${illegal.join(', ')}. ` +
            `Only status, reviewedBy, resolutionNote, and resolvedAt can be updated.`
        );
        err.code = 'CLAIM_IMMUTABILITY_VIOLATION';
        return next(err);
    }
    next();
});

module.exports = mongoose.model('Dispute', disputeSchema);
