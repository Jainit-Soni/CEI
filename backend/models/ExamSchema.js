const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    shortName: { type: String, trim: true },
    type: { type: String, trim: true },
    category: { type: String, trim: true },
    logo: { type: String },
    conductingBody: { type: String },
    stats: {
        applicants: { type: String },
        fee: { type: String },
        duration: { type: String },
        mode: { type: String }
    },
    markingScheme: {
        correct: { type: String },
        incorrect: { type: String }
    },
    safeScore: {
        min: { type: String },
        target: { type: String }
    },
    courses: [{ type: String }],
    pattern: [{ type: String }],
    totalMarks: { type: String },
    dates: {
        registration: { type: String },
        examWindow: { type: String },
        result: { type: String }
    },
    pastPapers: [{
        label: { type: String },
        url: { type: String }
    }],
    prepResources: [{
        title: { type: String },
        type: { type: String }
    }],
    officialUrl: { type: String },
    collegesAccepting: [{ type: String }]
}, { timestamps: true });

// Text indices for searching
examSchema.index({ name: 'text', shortName: 'text', category: 'text' });

module.exports = mongoose.model('Exam', examSchema);
