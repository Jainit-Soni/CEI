/**
 * models/ScoringVersion.js — CEI Scoring Constitution
 * =====================================================
 * Immutable record of a specific scoring engine configuration.
 * Think of each document as a signed constitutional amendment:
 *   — Once ACTIVATED, it cannot be altered.
 *   — Any weight change or rule change REQUIRES a new version.
 *   — Only one version is ACTIVE at any time.
 *   — All scoring runs are cryptographically linked to their version.
 *
 * IMMUTABILITY GUARANTEE:
 *   Pre-hooks on updateOne / findOneAndUpdate / updateMany block all writes
 *   to activated documents. New versions must be created via the
 *   GovernanceService.activateVersion() pathway only.
 */
const mongoose = require('mongoose');

const scoringVersionSchema = new mongoose.Schema({
    // ── Identity ────────────────────────────────────────────────────────────
    versionId: {
        type: String,
        required: true,
        unique: true,
        match: /^\d{4}\.\d{2}\.\d{2}-v\d+$/,   // Format: 2026.02.28-v1
        index: true
    },
    label: {
        type: String,
        maxlength: 100,
        default: ''
    },

    // ── Provenance ──────────────────────────────────────────────────────────
    engineVersion: {
        type: String, required: true   // e.g. "3.0.0"
    },
    engineCommitHash: {
        type: String, default: ''      // Git SHA at time of scoring
    },
    datasetHash: {
        type: String, required: true   // SHA-256 of input CSV
    },
    manifestRunTimestamp: {
        type: String, default: ''      // ISO timestamp from scoring_run_manifest.json
    },
    chaosPassedAt: {
        type: Date, default: null      // When chaos suite passed for this config
    },
    chaosReportPath: {
        type: String, default: ''
    },

    // ── The Constitution ────────────────────────────────────────────────────
    weights: {
        A: { type: Number, required: true },   // Accreditation
        F: { type: Number, required: true },   // Faculty / Legacy
        I: { type: Number, required: true },   // Infrastructure
        S: { type: Number, required: true },   // Scale
        D: { type: Number, required: true },   // Demand / Selectivity
        U: { type: Number, required: true },   // Urban Proximity
    },
    bandThresholds: {
        Elite: { type: Number, required: true },
        High: { type: Number, required: true },
        Competitive: { type: Number, required: true },
        Moderate: { type: Number, required: true },
        Emerging: { type: Number, default: 0 },
    },
    graceRules: {
        pattern: { type: String, required: true },   // Regex string for elite detection
        assignment: { type: String, default: 'A++ proxy (100 pts) if NAAC missing' }
    },
    penaltyRules: {
        maxPenalty: { type: Number, required: true },
        missingDistrictPts: { type: Number, default: 2 },
        missingStatePts: { type: Number, default: 3 },
        missingYearPts: { type: Number, default: 2 },
        missingNaacPts: { type: Number, default: 3 },
    },
    monteCarloConfig: {
        runs: { type: Number, required: true },
        noisePct: { type: Number, required: true },
        stabilityDays: { type: Number, default: 30 },   // Freeze window
    },

    // ── Lifecycle ───────────────────────────────────────────────────────────
    status: {
        type: String,
        enum: ['draft', 'active', 'archived'],
        default: 'draft',
        index: true
    },
    activatedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    freezeUntil: {
        type: Date,
        default: null,   // Set to activatedAt + 30 days on activation
    },

    // ── Record statistics (populated after activation) ─────────────────────
    recordCount: { type: Number, default: 0 },
    eliteCount: { type: Number, default: 0 },
    highCount: { type: Number, default: 0 },
    volatileCount: { type: Number, default: 0 },   // Institutions flagged as volatile

    // ── Change log vs previous version ─────────────────────────────────────
    previousVersionId: { type: String, default: null },
    changesSummary: { type: String, default: '' },  // Human-readable diff

    // ── Authorization ───────────────────────────────────────────────────────
    activatedBy: { type: String, default: 'system' },
    archivedBy: { type: String, default: null },

    createdAt: { type: Date, default: Date.now }
}, {
    collection: 'scoring_versions',
    versionKey: false,
    strict: true
});

// ── IMMUTABILITY ENFORCEMENT ─────────────────────────────────────────────────
// Once a version is ACTIVE or ARCHIVED, it is a constitutional record.
// No update operations are permitted. All changes must create a new version.

const MUTABLE_FIELDS_WHILE_DRAFT = ['status', 'label', 'chaosPassedAt', 'chaosReportPath',
    'changesSummary', 'activatedBy', 'archivedBy', 'activatedAt', 'archivedAt',
    'freezeUntil', 'recordCount', 'eliteCount', 'highCount', 'volatileCount', 'previousVersionId'];

function blockIllegalUpdate(update) {
    const fields = Object.keys(update?.$set || update || {});
    const constitutionalParts = ['weights', 'bandThresholds', 'graceRules', 'penaltyRules', 'monteCarloConfig',
        'datasetHash', 'engineVersion', 'versionId'];
    return fields.some(f => constitutionalParts.includes(f));
}

scoringVersionSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], async function (next) {
    try {
        const filter = this.getFilter();
        const update = this.getUpdate();

        // Find the document being updated
        const doc = await mongoose.model('ScoringVersion').findOne(filter, { status: 1 }).lean();
        if (!doc) return next(); // Document doesn't exist yet — allow

        // If active or archived, block ALL updates
        if (doc.status === 'active' || doc.status === 'archived') {
            const err = new Error(
                `[ScoringVersion] Immutability violation: version "${doc.versionId || doc._id}" ` +
                `is ${doc.status} and cannot be modified. Create a new version instead.`
            );
            err.code = 'IMMUTABILITY_VIOLATION';
            return next(err);
        }

        // If draft, block changes to constitutional fields
        if (doc.status === 'draft' && blockIllegalUpdate(update)) {
            const err = new Error(
                `[ScoringVersion] Constitutional fields (weights, bandThresholds, etc.) ` +
                `cannot be modified even in draft. Delete and recreate the version.`
            );
            err.code = 'CONSTITUTIONAL_VIOLATION';
            return next(err);
        }
    } catch (lookupErr) {
        return next(lookupErr);
    }
    next();
});

// Prevent any delete of active versions
scoringVersionSchema.pre(['deleteOne', 'findOneAndDelete', 'deleteMany'], async function (next) {
    const filter = this.getFilter();
    const doc = await mongoose.model('ScoringVersion').findOne(filter, { status: 1 }).lean();
    if (doc && (doc.status === 'active' || doc.status === 'archived')) {
        const err = new Error(
            `[ScoringVersion] Active and archived versions cannot be deleted. They are permanent records.`
        );
        err.code = 'DELETE_VIOLATION';
        return next(err);
    }
    next();
});

// ── Helper: compute weight checksum for diff comparison ───────────────────────
scoringVersionSchema.methods.weightChecksum = function () {
    const w = this.weights;
    return Object.values(w).reduce((sum, v) => sum + v, 0).toFixed(4);
};

module.exports = mongoose.model('ScoringVersion', scoringVersionSchema);
