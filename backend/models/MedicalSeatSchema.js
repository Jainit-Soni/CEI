const mongoose = require('mongoose');

const MedicalSeatSchema = new mongoose.Schema({
    medical_entity_id: { type: String, required: true, index: true },
    parent_core_id: { type: String, index: true },
    mcc_institute_code: { type: String, index: true },
    program_type: { type: String, enum: ['MBBS', 'BDS'], required: true },
    quota: { type: String, required: true },
    category: { type: String, required: true },
    seat_count: { type: Number, required: true },
    round: { type: String, required: true },
    year: { type: Number, default: 2025 },
    source_url: { type: String },
    lineage: { type: String, enum: ['hydrator', 'recovery'], required: true },
    hydration_confidence: { type: String, required: true },
    fingerprint: { type: String, unique: true, required: true } // entity|quota|category|round|count|url
}, { timestamps: true });

// Compound index for fast lookup within a college
MedicalSeatSchema.index({ medical_entity_id: 1, quota: 1, category: 1 });

module.exports = mongoose.model('MedicalSeat', MedicalSeatSchema);
