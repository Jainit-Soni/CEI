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
    
    // Rich Metadata (Enriched from Truth files)
    fees: {
        total: String,
        totalNumeric: Number,
        tuition: String,
        hostelFees: String,
        hostelNumeric: Number,
        source: String,
        session: String,
        isVerified: { type: Boolean, default: false }
    },
    placements: {
        averagePackage: String,
        averagePackageNumeric: Number,
        highestPackage: String,
        highestPackageNumeric: Number,
        placedPercentage: Number,
        academicYear: String,
        source: String,
        isVerified: { type: Boolean, default: false }
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
    strict: false // Allow for additional fields from diverse truth sources
});

// Compound Index for Search & Discovery
collegeSchema.index({ state: 1, rankingTier: -1 });
collegeSchema.index({ searchPriorityScore: -1, ceiScore: -1 });

// Ensure the model is named 'College' to match existing references
module.exports = mongoose.models.College || mongoose.model('College', collegeSchema);
