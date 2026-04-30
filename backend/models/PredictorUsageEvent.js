const mongoose = require('mongoose');

const PredictorUsageEventSchema = new mongoose.Schema({
  session_id: { type: String, required: true, index: true },
  domain: { type: String, enum: ['engineering', 'medical'], required: true, index: true },
  event_type: { 
    type: String, 
    enum: ['prediction_run', 'result_click', 'feedback'], 
    required: true,
    index: true
  },
  input: {
    rank: Number,
    category: String,
    quota: String,
    genderPool: String,
    program: String,
    state: String,
    authority: String
  },
  result_summary: {
    safe_count: Number,
    realistic_count: Number,
    risky_count: Number,
    extreme_count: Number,
    total_count: Number
  },
  clicked_result: {
    institution_id: String,
    medical_entity_id: String,
    band: String,
    position: Number,
    program: String
  },
  feedback: {
    helpful: Boolean,
    reason: String
  },
  created_at: { type: Date, default: Date.now, index: true }
});

// Indexes for common analytics queries
PredictorUsageEventSchema.index({ domain: 1, event_type: 1 });
PredictorUsageEventSchema.index({ created_at: -1 });

module.exports = mongoose.model('PredictorUsageEvent', PredictorUsageEventSchema);
