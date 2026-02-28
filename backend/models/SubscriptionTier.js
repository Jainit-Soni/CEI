/**
 * models/SubscriptionTier.js — CEI Monetization Schema (Phase XV)
 * ================================================================
 * Defines API rate limits and feature flags per subscription tier.
 * ZERO coupling to ScoringVersion. Cannot modify scores.
 * Changes are logged to AuditLog.
 */

const mongoose = require('mongoose');

const SubscriptionTierSchema = new mongoose.Schema({
    tierId: { type: String, required: true, unique: true, enum: ['free', 'pro', 'enterprise'] },
    displayName: { type: String, required: true },   // e.g. "Pro Intelligence"

    // ── Rate Limits ─────────────────────────────────────────────────────────
    rateLimits: {
        requestsPerWindow: { type: Number, default: 100 },  // Per 15-minute window
        windowMs: { type: Number, default: 900000 },
        burstAllowance: { type: Number, default: 0 }      // Extra burst headroom
    },

    // ── Feature Flags ───────────────────────────────────────────────────────
    features: {
        publicApi: { type: Boolean, default: true },   // /api/v1/*
        basicForecast: { type: Boolean, default: true },   // branch forecast
        trajectorySim: { type: Boolean, default: false },  // Monte Carlo trajectory
        simulatorAccess: { type: Boolean, default: false },  // what-if simulator
        peerCluster: { type: Boolean, default: false },  // peer cluster API
        evidencePackets: { type: Boolean, default: false },  // PDF/JSON evidence
        bulkDataExport: { type: Boolean, default: false },  // bulk record access
        customCluster: { type: Boolean, default: false },  // custom peer clustering
        verifyAccess: { type: Boolean, default: true },   // /api/verify/* (always free)
        // IMMUTABLE — these can NEVER be tier-gated:
        scoreVisibility: { type: Boolean, default: true, immutable: true }, // Scores always public
        methodologyAccess: { type: Boolean, default: true, immutable: true }  // Methodology always open
    },

    // ── Pricing (metadata only — no payment processing here) ────────────────
    pricing: {
        monthlyUSD: { type: Number, default: 0 },
        annualUSD: { type: Number, default: 0 },
        currency: { type: String, default: 'USD' }
    },

    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

// ── Immutability Guards ───────────────────────────────────────────────────────

SubscriptionTierSchema.pre('save', function (next) {
    // Ensure immutable features remain true regardless of what is submitted
    if (this.features) {
        this.features.scoreVisibility = true;
        this.features.methodologyAccess = true;
        this.features.verifyAccess = true;
    }
    next();
});

SubscriptionTierSchema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
    const update = this.getUpdate();
    const nested = update?.$set || update || {};
    // Block any attempt to set score/methodology gates to false
    if (nested['features.scoreVisibility'] === false ||
        nested['features.methodologyAccess'] === false) {
        return next(new Error('GOVERNANCE: scoreVisibility and methodologyAccess must always be true. This is a chartered immutable right.'));
    }
    next();
});

// ── Statics ───────────────────────────────────────────────────────────────────

SubscriptionTierSchema.statics.seed = async function () {
    const defaults = [
        {
            tierId: 'free', displayName: 'Free Access',
            rateLimits: { requestsPerWindow: 100, windowMs: 900000, burstAllowance: 0 },
            features: { publicApi: true, basicForecast: true, trajectorySim: false, simulatorAccess: false, peerCluster: false, evidencePackets: false, bulkDataExport: false, customCluster: false },
            pricing: { monthlyUSD: 0, annualUSD: 0 }
        },
        {
            tierId: 'pro', displayName: 'Pro Intelligence',
            rateLimits: { requestsPerWindow: 1000, windowMs: 900000, burstAllowance: 200 },
            features: { publicApi: true, basicForecast: true, trajectorySim: true, simulatorAccess: true, peerCluster: true, evidencePackets: true, bulkDataExport: false, customCluster: false },
            pricing: { monthlyUSD: 49, annualUSD: 499 }
        },
        {
            tierId: 'enterprise', displayName: 'Enterprise Infrastructure',
            rateLimits: { requestsPerWindow: 10000, windowMs: 900000, burstAllowance: 2000 },
            features: { publicApi: true, basicForecast: true, trajectorySim: true, simulatorAccess: true, peerCluster: true, evidencePackets: true, bulkDataExport: true, customCluster: true },
            pricing: { monthlyUSD: 299, annualUSD: 2999 }
        }
    ];

    for (const t of defaults) {
        await this.findOneAndUpdate({ tierId: t.tierId }, t, { upsert: true, new: true });
    }
};

module.exports = mongoose.models.SubscriptionTier ||
    mongoose.model('SubscriptionTier', SubscriptionTierSchema);
