/**
 * routes/placementReality.js — CEI Placement Reality Engine API (Phase XVI)
 * ==========================================================================
 * Public:
 *   GET /api/placement-reality/:collegeId           — score + label + anomaly flags
 *
 * Admin (JWT):
 *   POST /api/placement-reality/recompute/:collegeId — force recompute using live data
 */

const express = require('express');
const router = express.Router();

const PlacementReality = require('../models/PlacementReality');
const AuditLog = require('../models/AuditLog');
const College = require('../models/CollegeSchema');
const { requireRole } = require('../lib/jwtAuth');
const pd = require('../lib/placementDetector');

// ── Redis (optional) ────────────────────────────────────────────────────────
let redisClient = null;
try { redisClient = require('../lib/redisClient').getClient(); } catch { /* no cache */ }

async function cacheGet(key) {
    try { const v = await redisClient?.get(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function cacheSet(key, val, ttlSec = 1800) {
    try { await redisClient?.set(key, JSON.stringify(val), 'EX', ttlSec); } catch { /* ignore */ }
}

// ── Recompute helper ─────────────────────────────────────────────────────────

async function recompute(collegeId) {
    // Fetch target college
    const college = await College.findOne({ college_id: collegeId }).lean();
    if (!college) throw new Error(`College ${collegeId} not found.`);

    // Fetch peers (same state, same tier, exclude self)
    const peers = await College.find({
        state: college.state,
        tier: college.tier,
        college_id: { $ne: collegeId }
    }).select('avg_package college_id').limit(200).lean();

    // Fetch audit history for drift
    const auditHistory = await AuditLog.find({
        entityId: collegeId,
        fieldName: 'avg_package'
    }).sort({ createdAt: 1 }).limit(10).lean();

    // Layer 1 — Statistical Outlier
    const outlier = pd.detectStatisticalOutlier(college, peers);

    // Layer 2 — Historical Drift
    const drift = pd.detectHistoricalDrift(auditHistory);

    // Layer 3 — Cross-Source Variance (use stored src values if any, else skip)
    const crossSource = pd.detectCrossSourceVariance(
        college.avg_package,
        college.nirf_avg_package ? [college.nirf_avg_package] : []
    );

    // Layer 4 — Company Reality (compare claimed vs known recruiters)
    const claimedCompanies = college.companies_visiting || [];
    const alumniEmployers = college.alumni_companies || [];
    const companyReality = pd.detectCompanyReality(claimedCompanies, alumniEmployers);

    // Composite score
    const result = pd.computePlacementRealityScore({ outlier, drift, crossSource, companyReality });

    // Persist
    const doc = await PlacementReality.findOneAndUpdate(
        { collegeId },
        {
            ...result,
            collegeId,
            lastComputed: new Date()
        },
        { upsert: true, new: true }
    );

    return doc;
}

// ── GET /api/placement-reality/:collegeId ────────────────────────────────────
router.get('/:collegeId', async (req, res) => {
    const { collegeId } = req.params;
    const cacheKey = `pr:${collegeId}`;

    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ source: 'cache', data: cached });

    try {
        // Try stored result first
        let doc = await PlacementReality.findOne({ collegeId }).lean();

        if (!doc) {
            // First-time call: compute on demand
            doc = await recompute(collegeId);
        }

        const payload = {
            collegeId,
            placementRealityScore: doc.placementRealityScore,
            reliabilityLabel: doc.reliabilityLabel,
            emoji: doc.reliabilityLabel === 'Highly Reliable' ? '🟢'
                : doc.reliabilityLabel === 'Moderate Confidence' ? '🟡' : '🔴',
            layerScores: doc.layerScores,
            anomalyFlags: doc.anomalyFlags,
            diagnostics: {
                peerZScore: doc.peerZScore,
                yoyGrowthRatio: doc.yoyGrowthRatio,
                crossSourceVariancePct: doc.crossSourceVariancePct
            },
            lastComputed: doc.lastComputed
        };

        await cacheSet(cacheKey, payload, 1800); // 30-min TTL
        return res.json({ source: 'db', data: payload });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ── POST /api/placement-reality/recompute/:collegeId (admin) ─────────────────
router.post('/recompute/:collegeId', requireRole('super_admin', 'data_curator'), async (req, res) => {
    const { collegeId } = req.params;

    try {
        const doc = await recompute(collegeId);

        // Bust cache
        await cacheSet(`pr:${collegeId}`, null, 1);

        return res.json({
            message: 'Placement reality recomputed.',
            placementRealityScore: doc.placementRealityScore,
            reliabilityLabel: doc.reliabilityLabel,
            anomalyFlags: doc.anomalyFlags
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
