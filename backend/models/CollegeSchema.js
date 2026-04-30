const mongoose = require('mongoose');

/**
 * CEI College Schema — Production Grade (MongoDB)
 * ==============================================
 * This schema replaces the previous in-memory Mock.
 * It is designed for high-performance querying of 60k+ institutes.
 */
const collegeSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    stableKey: { type: String, index: true },
    name: { type: String, required: true, trim: true, index: 'text' },
    shortName: { type: String, trim: true },
    location: { type: String, trim: true },
    state: { type: String, trim: true, index: true },
    city: { type: String, trim: true, index: true },
    district: { type: String, trim: true },
    collegeType: { type: String, trim: true },
    ownership: { type: String, trim: true },
    established: { type: String },
    isCore: { type: Boolean, default: false, index: true },
    
    // Strategic Intelligence Fields
    ceiScore: { type: Number, index: true },
    dataConfidenceScore: { type: Number },
    institutionStrengthScore: { type: Number },
    admissionRealityScore: { type: Number },
    searchPriorityScore: { type: Number, index: true },
    coverage: { type: Object },
    rankingTier: { type: String, index: true },
    authority: { type: String, index: true }, // JoSAA / State
    authority_canonical: { 
        type: String, 
        enum: ['JOSAA', 'STATE', 'MCC', 'UNKNOWN'], 
        default: 'UNKNOWN',
        index: true 
    },
    authority_source: { 
        type: String, 
        enum: ['derived', 'verified'], 
        default: 'derived' 
    },
    isVisible: { type: Boolean, default: true, index: true },
    isPremium: { type: Boolean, default: false, index: true },
    identityConfidence: { type: String, index: true }, // HIGH / MEDIUM / LOW
    lastCoverageSync: { type: Date, default: Date.now },

    
    // Rich Metadata (Enriched from Truth files)

    fees: {
        total: String,
        totalFee: Number,
        totalNumeric: Number,
        tuition: String,
        hostelFees: { type: mongoose.Schema.Types.Mixed },
        hostelNumeric: Number,
        source: String,
        session: String,
        isVerified: { type: Boolean, default: false },
        provenance: { type: mongoose.Schema.Types.Mixed },
        // Trust Metadata
        source_authority: { type: String, enum: ['official_institute', 'primary_authority', 'secondary', 'unverified'], default: 'unverified' },
        source_url: String,
        academic_year: String,
        extracted_at: { type: Date, default: Date.now },
        stale_after_days: { type: Number, default: 365 }
    },
    placements: {
        averagePackage: String,
        averagePackageNumeric: Number,
        highestPackage: String,
        highestPackageNumeric: Number,
        placedPercentage: Number,
        academicYear: String,
        source: String,
        isVerified: { type: Boolean, default: false },
        provenance: { type: mongoose.Schema.Types.Mixed },
        // Trust Metadata
        source_authority: { type: String, enum: ['official_institute', 'primary_authority', 'secondary', 'unverified'], default: 'unverified' },
        source_url: String,
        academic_year: String,
        extracted_at: { type: Date, default: Date.now },
        stale_after_days: { type: Number, default: 365 }
    },
    rankings: [{
        source: String,
        rank: Number,
        year: String,
        category: String
    }],
    courses: [{
        name: String,
        duration: String,
        intake: Number,
        exams: [String]
    }],
    
    // Contact & Affiliation
    website: { type: String },
    email: { type: String },
    phone: { type: String },
    affiliatedTo: { type: String },
    accreditation: {
        naac: String,
        naacScore: Number,
        nba: Boolean
    },
    coordinates: {
        lat: Number,
        lng: Number
    },
    
    // External IDs
    nirfRank: { type: Number },
    aisheCode: { type: String, index: true },
    
    // Auditing & Provenance (Strict matching support)
    sourceMetadata: { type: Object },
    stateRepairSource: { type: String },
    stateRepairAppliedAt: { type: Date },
    stateRepairConfidence: { type: Number },
    stateRepairEvidence: { type: String }
    
}, { 
    timestamps: true,
    strict: false, // Allow for additional fields from diverse truth sources
    strictQuery: false // Ensure non-schema fields are not stripped from queries
});


// Compound Index for Search & Discovery
collegeSchema.index({ state: 1, rankingTier: -1 });
collegeSchema.index({ searchPriorityScore: -1, ceiScore: -1 });

// Ensure the model is named 'College' and points to the 'institutions' collection
module.exports = mongoose.models.College || mongoose.model('College', collegeSchema, 'institutions');
