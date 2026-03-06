/**
 * models/SourceEvidence.js — CEI National Data Verification Engine (Phase XVI)
 * =============================================================================
 * A single source record linked to a VerifiedField.
 * One field can have multiple sources — multi-source agreement = higher confidence.
 */

const mongoose = require('mongoose');

const SOURCE_TYPES = ['OFFICIAL', 'GOV_PORTAL', 'THIRD_PARTY', 'CROWDSOURCED', 'ALUMNI_DATA'];
const TRUST_LEVELS = ['HIGH', 'MEDIUM', 'LOW'];
const EXTRACTION_METHODS = ['MANUAL', 'WEB_SCRAPE', 'API_PULL', 'DOC_UPLOAD', 'ALUMNI_SURVEY'];

const SourceEvidenceSchema = new mongoose.Schema({
    // ── Link ───────────────────────────────────────────────────────────────────
    verifiedFieldId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VerifiedField',
        required: true,
        index: true
    },
    collegeId: { type: String, required: true, index: true },
    fieldName: { type: String, required: true },

    // ── Source Metadata ────────────────────────────────────────────────────────
    sourceType: { type: String, enum: SOURCE_TYPES, required: true },
    sourceURL: { type: String, maxlength: 2000, default: null },
    capturedAt: { type: Date, required: true, default: Date.now },
    extractionMethod: { type: String, enum: EXTRACTION_METHODS, default: 'MANUAL' },

    // ── Raw Value ──────────────────────────────────────────────────────────────
    rawValue: { type: mongoose.Schema.Types.Mixed, required: true },
    normalizedValue: { type: mongoose.Schema.Types.Mixed, default: null }, // after pipeline normalization

    // ── Trust ──────────────────────────────────────────────────────────────────
    trustLevel: { type: String, enum: TRUST_LEVELS, required: true },
    isActive: { type: Boolean, default: true },        // false = superseded by newer evidence
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SourceEvidence', default: null },

    // ── Submitter ──────────────────────────────────────────────────────────────
    submittedBy: { type: String, default: 'system' } // admin ID or 'system'

}, {
    collection: 'source_evidence',
    timestamps: true,
    versionKey: false
});

SourceEvidenceSchema.index({ verifiedFieldId: 1, isActive: 1 });
SourceEvidenceSchema.index({ collegeId: 1, fieldName: 1, isActive: 1 });

module.exports = mongoose.models.SourceEvidence ||
    mongoose.model('SourceEvidence', SourceEvidenceSchema);
