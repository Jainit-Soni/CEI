const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    name: String,
    degree: String,
    duration: String,
    exams: [String]
}, { _id: false });

const cutoffSchema = new mongoose.Schema({
    examId: String,
    year: String,
    cutoff: String,
    source: String
}, { _id: false });

const placementSchema = new mongoose.Schema({
    averagePackage: String,
    medianPackage: String,
    highestPackage: String,
    placementRate: String,
    highestPackageNumeric: Number,
    // Confidence label for public display
    confidenceLabel: {
        type: String,
        enum: ['audited', 'self_declared', 'under_review', 'unverified'],
        default: 'unverified'
    }
}, { _id: false });

const metaSchema = new mongoose.Schema({
    sourceType: [String],
    affiliations: [String],
    ownership: String,
    establishedYear: String,
    district: String,
    naacGrade: String
}, { _id: false });

// ── Data Source Record ──────────────────────────────────────────────────────
// Attached to each critical field to trace its provenance.
const dataSourceRecordSchema = new mongoose.Schema({
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    source_type: {
        type: String,
        enum: ['government_registry', 'official_website', 'audited_report', 'third_party_report', 'self_declared', 'unknown'],
        default: 'unknown'
    },
    source_url: { type: String, default: null },
    source_document_hash: { type: String, default: null }, // SHA-256 of uploaded evidence
    verification_status: {
        type: String,
        enum: ['unverified', 'auto_verified', 'manually_verified', 'disputed'],
        default: 'unverified'
    },
    verified_at: { type: Date, default: null },
    verifier_type: {
        type: String,
        enum: ['aishe', 'ugc', 'aicte', 'human_reviewer', 'auto_engine', 'none'],
        default: 'none'
    },
    confidence_level: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'low'
    }
}, { _id: false });

const collegeSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        index: true
    },
    shortName: String,
    location: String,
    state: {
        type: String,
        index: true
    },
    rankingTier: {
        type: String,
        enum: ['Tier 1', 'Tier 2', 'Tier 3', 'Stand Alone', 'University'],
        default: 'Tier 3',
        index: true
    },
    overview: String,
    campus: String,
    officialUrl: String,
    acceptedExams: [String],
    courses: [courseSchema],
    pastCutoffs: [cutoffSchema],
    topRecruiters: [String],
    tuition: String,
    sources: [String],
    meta: metaSchema,
    placements: placementSchema,
    aisheCode: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    isPremium: {
        type: Boolean,
        default: false
    },

    // ── CEI Intelligence Properties ──────────────────────────────────────────
    ceiScore: {
        type: Number,
        min: 0,
        max: 100,
        index: true
    },
    competitivenessBand: {
        type: String,
        enum: ['Elite', 'High', 'Competitive', 'Moderate', 'Emerging'],
        index: true
    },
    canonicalId: {
        type: String,
        index: true,
        unique: true,
        sparse: true
    },
    verificationStatus: {
        type: String,
        enum: ['VERIFIED', 'UNVERIFIED', 'UNVERIFIED_NO_STUDENTS', 'UNVERIFIED_NOT_IN_SOURCE', 'UNVERIFIED_MISSING_META'],
        default: 'UNVERIFIED',
        index: true
    },
    lastScoreUpdate: { type: Date },

    // ── Data Integrity & Trust Layer (Phase X) ───────────────────────────────
    /**
     * Per-field provenance map. Each key is a critical field name.
     * Populated by the verification engine; missing = unverified by default.
     */
    fieldSources: {
        establishedYear: { type: dataSourceRecordSchema, default: null },
        campusSize: { type: dataSourceRecordSchema, default: null },
        accreditationStatus: { type: dataSourceRecordSchema, default: null },
        affiliations: { type: dataSourceRecordSchema, default: null },
        coursesOffered: { type: dataSourceRecordSchema, default: null },
        studentIntake: { type: dataSourceRecordSchema, default: null },
        avgPackage: { type: dataSourceRecordSchema, default: null },
        highestPackage: { type: dataSourceRecordSchema, default: null },
        placementRate: { type: dataSourceRecordSchema, default: null },
        companiesVisiting: { type: dataSourceRecordSchema, default: null },
        facultyCount: { type: dataSourceRecordSchema, default: null },
        infrastructureMetric: { type: dataSourceRecordSchema, default: null }
    },

    /**
     * Computed score (0–100) reflecting the trustworthiness of this institution's
     * data across all critical fields. Recomputed on each verification event.
     */
    dataIntegrityScore: {
        type: Number,
        min: 0,
        max: 100,
        default: null,
        index: true
    },

    /**
     * Public-facing confidence label derived from dataIntegrityScore.
     * 🟢 high (score >= 70), 🟡 moderate (40-69), 🔴 low (<40 or no data)
     */
    dataConfidenceLabel: {
        type: String,
        enum: ['high', 'moderate', 'low'],
        default: 'low',
        index: true
    },

    /** Flags true if the anomaly scanner has open unresolved alerts for this institution */
    hasOpenAnomalies: {
        type: Boolean,
        default: false,
        index: true
    },

    /** Flags true if a government data mismatch (AISHE/UGC/AICTE) is unresolved */
    hasGovernmentMismatch: {
        type: Boolean,
        default: false,
        index: true
    },

    /** Last time the data integrity engine re-evaluated this institution */
    lastIntegrityCheck: { type: Date, default: null }

}, {
    timestamps: true
});


// Text index for global search
collegeSchema.index({ name: 'text', shortName: 'text', location: 'text' });

// Compound indexes for extremely fast, low-memory sorting during deep pagination
collegeSchema.index({ isPremium: -1, name: 1 });
collegeSchema.index({ rankingTier: 1, isPremium: -1 });
collegeSchema.index({ rankingTier: -1, isPremium: -1 });

const College = mongoose.model('College', collegeSchema);

module.exports = College;
