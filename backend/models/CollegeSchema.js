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
    highestPackageNumeric: Number
}, { _id: false });

const metaSchema = new mongoose.Schema({
    sourceType: [String],
    affiliations: [String],
    ownership: String,
    establishedYear: String,
    district: String,
    naacGrade: String
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
        index: true // For fast text searching
    },
    shortName: String,
    location: String,
    state: {
        type: String,
        index: true // For state-based filtering
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
        default: false // True for our 1789 hand-curated colleges, false for raw AISHE shells
    },
    // CEI Intelligence Properties
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
    lastScoreUpdate: {
        type: Date
    }
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
