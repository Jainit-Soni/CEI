const mongoose = require('mongoose');

const MedicalCutoffSchema = new mongoose.Schema({
    medical_entity_id: { type: String, required: true, index: true },
    parent_core_id: { type: String, index: true },
    mcc_institute_code: { type: String, index: true },
    program_type: { type: String, enum: ['MBBS', 'BDS'], required: true },
    quota: { type: String, required: true },
    category: { type: String, required: true },
    closing_rank: { type: Number, required: true, index: true },
    round: { type: String, required: true },
    year: { type: Number, default: 2025 },
    source_url: { type: String },
    lineage: { type: String, enum: ['hydrator', 'recovery'], required: true },
    hydration_confidence: { type: String, required: true },
    fingerprint: { type: String, unique: true, required: true } // entity|quota|category|round|year|rank
}, { timestamps: true });

// Compound index for filtering
MedicalCutoffSchema.index({ medical_entity_id: 1, quota: 1, round: 1 });

module.exports = mongoose.model('MedicalCutoff', MedicalCutoffSchema);
