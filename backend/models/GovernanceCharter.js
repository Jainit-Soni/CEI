/**
 * models/GovernanceCharter.js — CEI Governance Charter Registry (Phase XV)
 * =========================================================================
 * Immutable MongoDB record per governance charter version.
 * Once set to status:'ratified', no field may be modified.
 */

const mongoose = require('mongoose');

const GovernanceCharterSchema = new mongoose.Schema({
    version: { type: String, required: true, unique: true }, // e.g. "v1.0"
    status: { type: String, enum: ['draft', 'ratified'], default: 'draft' },
    charterText: { type: String, required: true },               // Full markdown text
    charterHash: { type: String, required: true },               // SHA-256 of charterText
    ratifiedAt: { type: Date },
    ratifiedBy: { type: String },  // JWT sub of ratifying super_admin
    articles: [{ title: String, clauseCount: Number }],       // Article index
    changesSummary: { type: String }  // What changed from previous version (v2+)
}, {
    timestamps: true,
    // Soft-versionKey so we can detect mutation attempts in pre-hook
    versionKey: '__v'
});

// ── Immutability Enforcement ───────────────────────────────────────────────

GovernanceCharterSchema.pre('save', function (next) {
    if (!this.isNew && this.get('status') === 'ratified') {
        return next(new Error(
            'GovernanceCharter: Ratified charters are immutable. Create a new version to amend.'
        ));
    }
    next();
});

GovernanceCharterSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], async function (next) {
    const filter = this.getFilter();
    const existing = await mongoose.model('GovernanceCharter').findOne(filter, { status: 1 }).lean();
    if (existing?.status === 'ratified') {
        return next(new Error('GovernanceCharter: Cannot update a ratified charter record.'));
    }
    next();
});

// ── Static Methods ─────────────────────────────────────────────────────────

GovernanceCharterSchema.statics.getLatestRatified = function () {
    return this.findOne({ status: 'ratified' }).sort({ ratifiedAt: -1 }).lean();
};

GovernanceCharterSchema.statics.ratify = async function (version, ratifiedBy) {
    const charter = await this.findOne({ version, status: 'draft' });
    if (!charter) throw new Error(`No draft charter found for version: ${version}`);
    charter.status = 'ratified';
    charter.ratifiedAt = new Date();
    charter.ratifiedBy = ratifiedBy;
    await charter.save();
    return charter;
};

GovernanceCharterSchema.statics.computeHash = function (text) {
    return require('crypto').createHash('sha256').update(text).digest('hex');
};

module.exports = mongoose.models.GovernanceCharter ||
    mongoose.model('GovernanceCharter', GovernanceCharterSchema);
