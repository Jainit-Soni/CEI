/**
 * models/ReporterReputation.js — CEI Trust Reporting Reputation System (Phase XVI)
 * ==================================================================================
 * Tracks the trustScore of each data reporter.
 * Score starts at 50/100, increases with validated reports, decreases with false reports.
 * This weight is applied to the anomaly boost of each submitted TrustReport.
 */

const mongoose = require('mongoose');

const ReporterReputationSchema = new mongoose.Schema({
    // ── Identity ───────────────────────────────────────────────────────────────
    // One of the two will be set. userId takes priority if the user is logged in.
    userId: { type: String, default: null, sparse: true, index: true },
    ipHash: { type: String, default: null, sparse: true, index: true },

    // ── Reputation Score ────────────────────────────────────────────────────────
    trustScore: { type: Number, default: 50, min: 0, max: 100 },

    // ── Activity Counters ──────────────────────────────────────────────────────
    totalReports: { type: Number, default: 0 },
    validatedReports: { type: Number, default: 0 },  // reports that were confirmed correct
    falseReports: { type: Number, default: 0 },  // reports that were rejected as false

    // ── Rate Limiting ──────────────────────────────────────────────────────────
    lastReportAt: { type: Date, default: null },
    reportsToday: { type: Number, default: 0 },
    reportsTodayAt: { type: Date, default: null }  // date of the reportsToday counter

}, {
    collection: 'reporter_reputation',
    timestamps: true,
    versionKey: false
});

// ── Reputation Adjustment Logic ────────────────────────────────────────────────

ReporterReputationSchema.methods.applyOutcome = function (outcome) {
    if (outcome === 'validated') {
        this.validatedReports++;
        this.trustScore = Math.min(100, this.trustScore + 5);
    } else if (outcome === 'rejected') {
        this.falseReports++;
        this.trustScore = Math.max(0, this.trustScore - 10);
    }
    return this;
};

// ── Daily Counter Reset ────────────────────────────────────────────────────────

ReporterReputationSchema.methods.checkAndResetDailyCounter = function () {
    const today = new Date().toDateString();
    if (!this.reportsTodayAt || new Date(this.reportsTodayAt).toDateString() !== today) {
        this.reportsToday = 0;
        this.reportsTodayAt = new Date();
    }
};

module.exports = mongoose.models.ReporterReputation ||
    mongoose.model('ReporterReputation', ReporterReputationSchema);
