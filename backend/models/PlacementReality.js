/**
 * models/PlacementReality.js — CEI Placement Reality Engine (Phase XVI)
 * ======================================================================
 * Stores the computed PlacementRealityScore and anomaly flags per college.
 * Recomputed by the weekly cron job or on admin demand.
 *
 * Score Legend:
 *   75–100 → 🟢 Highly Reliable
 *   50–74  → 🟡 Moderate Confidence
 *   0–49   → 🔴 Suspicious Data
 */

const mongoose = require('mongoose');

const AnomalyFlagSchema = new mongoose.Schema({
    layer: { type: String, enum: ['statistical_outlier', 'historical_drift', 'cross_source', 'company_reality'], required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    description: { type: String, maxlength: 500 },
    triggeredAt: { type: Date, default: Date.now },
    data: { type: mongoose.Schema.Types.Mixed, default: null } // z-score, growth ratio, etc.
}, { _id: false });

const PlacementRealitySchema = new mongoose.Schema({
    // ── Identity ───────────────────────────────────────────────────────────────
    collegeId: { type: String, required: true, unique: true, index: true },

    // ── Score ──────────────────────────────────────────────────────────────────
    placementRealityScore: { type: Number, min: 0, max: 100, default: null },
    reliabilityLabel: {
        type: String,
        enum: ['Highly Reliable', 'Moderate Confidence', 'Suspicious Data', 'Insufficient Data'],
        default: 'Insufficient Data'
    },

    // ── Layer Scores ────────────────────────────────────────────────────────────
    layerScores: {
        statisticalOutlier: { type: Number, default: null }, // 0–100 (100 = not an outlier)
        historicalDrift: { type: Number, default: null },
        crossSource: { type: Number, default: null },
        companyReality: { type: Number, default: null }
    },

    // ── Anomaly Flags ──────────────────────────────────────────────────────────
    anomalyFlags: [AnomalyFlagSchema],

    // ── Computed Data Points ──────────────────────────────────────────────────
    peerZScore: { type: Number, default: null },
    yoyGrowthRatio: { type: Number, default: null }, // e.g. 2.0 = 200% growth
    crossSourceVariancePct: { type: Number, default: null },

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    lastComputed: { type: Date, default: null },
    computationVersion: { type: String, default: '1.0' }

}, {
    collection: 'placement_reality',
    timestamps: true,
    versionKey: false
});

PlacementRealitySchema.index({ placementRealityScore: 1 });
PlacementRealitySchema.index({ reliabilityLabel: 1 });

module.exports = mongoose.models.PlacementReality ||
    mongoose.model('PlacementReality', PlacementRealitySchema);
