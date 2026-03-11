/**
 * routes/admin.js — CEI Admin API
 * ================================
 * All routes protected by Firebase Google Auth (middleware/adminAuth.js).
 * Only jainitsoni07@gmail.com and jainit.developer@gmail.com can access.
 *
 * Write routes invalidate page + ranking caches immediately on change.
 */

const express = require("express");
const router = express.Router();
const College = require("../models/CollegeSchema");
const { invalidateCache } = require("../services/dataStore");
const cache = require("../services/cache");
const scheduler = require("../lib/scheduler");
const rankingCache = require("../services/rankingCacheBuilder");
const pageCache = require("../services/collegePageCache");
const adminAuth = require("../middleware/adminAuth");
const TrustReport = require("../models/TrustReport");
const AdminAuditLog = require("../models/AdminAuditLog");

// Apply adminAuth to ALL routes in this file
router.use(adminAuth);

// ── College CRUD ──────────────────────────────────────────────────────────────

// Get all colleges for admin (paginated, with search)
router.get("/colleges", async (req, res) => {
    try {
        const { q, page = 1, limit = 50 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const filter = q
            ? {
                $or: [
                    { name: { $regex: q, $options: "i" } },
                    { shortName: { $regex: q, $options: "i" } },
                    { id: { $regex: q, $options: "i" } },
                ]
            }
            : {};

        const [colleges, total] = await Promise.all([
            College.find(filter)
                .select("id name shortName location state rankingTier ceiScore")
                .skip(skip).limit(limitNum).lean(),
            College.countDocuments(filter)
        ]);

        res.json({ colleges, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a new college
router.post("/colleges", async (req, res) => {
    try {
        const college = new College(req.body);
        const saved = await college.save();

        await cache.delPattern("mongo:colleges:*");
        await cache.del(`mongo:college:${saved.id}`);
        await rankingCache.invalidateForCollege(saved);
        await pageCache.invalidateCollegePage(saved.id);
        await invalidateCache().catch(() => { });

        res.status(201).json(saved);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a college
router.delete("/colleges/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const college = await College.findOne({ id }).lean();
        if (!college) return res.status(404).json({ error: "College not found" });

        await College.deleteOne({ id });
        await cache.delPattern("mongo:colleges:*");
        await cache.del(`mongo:college:${id}`);
        await rankingCache.invalidateForCollege(college);
        await pageCache.invalidateCollegePage(id);
        await invalidateCache().catch(() => { });

        res.json({ success: true, id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a college
router.patch("/colleges/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        delete updates._id; delete updates.__v;

        const updated = await College.findOneAndUpdate(
            { id },
            { $set: updates },
            { new: true, lean: true }
        );
        if (!updated) return res.status(404).json({ error: "College not found" });

        await cache.del(`mongo:college:${id}`);
        await cache.delPattern("mongo:colleges:*");
        await rankingCache.invalidateForCollege(updated);
        await pageCache.invalidateCollegePage(id);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Cache Management ──────────────────────────────────────────────────────────

router.post("/cache/invalidate", async (req, res) => {
    try {
        await invalidateCache();
        await cache.delPattern("mongo:*");
        res.json({ success: true, message: "Cache invalidated and reloaded from MongoDB" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rebuild ranking + page caches
router.post("/cache/rebuild", async (req, res) => {
    try {
        const [rankingResult, pageResult] = await Promise.allSettled([
            rankingCache.rebuildAll(),
            pageCache.rebuildAll(),
        ]);
        res.json({
            success: true,
            ranking: rankingResult.status === 'fulfilled' ? rankingResult.value : { error: rankingResult.reason?.message },
            page: pageResult.status === 'fulfilled' ? pageResult.value : { error: pageResult.reason?.message },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get("/cache-status", async (req, res) => {
    try {
        const { getRedisClient } = require("../config/redis");
        const redis = await getRedisClient();
        if (!redis) return res.json({ redis: 'unavailable' });

        const info = await redis.info('stats');
        const keyspaceHits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || 0);
        const keyspaceMisses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || 0);
        const total = keyspaceHits + keyspaceMisses;

        res.json({
            redis: 'connected',
            keyspaceHits,
            keyspaceMisses,
            hitRate: total > 0 ? ((keyspaceHits / total) * 100).toFixed(1) + '%' : 'N/A',
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Background Jobs ───────────────────────────────────────────────────────────

router.get("/jobs", (req, res) => {
    res.json({
        jobs: [
            { name: 'weekly-anomaly-scan', schedule: 'Sunday 02:00 IST', description: 'Z-score + rate anomaly detection across all 68k institutions' },
            { name: 'monthly-integrity-recompute', schedule: '1st of month 03:00 IST', description: 'Recomputes data integrity scores for all verified fields' },
            { name: 'freeze-window-check', schedule: 'Daily 09:00 IST', description: 'Checks for expiring scoring freeze windows' },
            { name: 'daily-report-processing', schedule: 'Daily 01:00 IST', description: 'Processes pending trust reports and creates verification tasks' },
            { name: 'weekly-placement-scan', schedule: 'Wednesday 03:00 IST', description: 'Runs placement reality detector across all colleges' },
            { name: 'monthly-full-verification', schedule: '2nd of month 04:00 IST', description: 'Re-verifies all field confidence scores and statuses' },
            { name: 'rebuild-ranking-caches', schedule: 'Every 12h (00:30 and 12:30 UTC)', description: 'Precomputes top-200 ranking lists for all states, tiers, bands into Redis' },
            { name: 'rebuild-page-caches', schedule: 'Every 6h (00:45, 06:45, 12:45, 18:45 UTC)', description: 'Precomputes full page payload per college (college+anomalies+integrity) into Redis' },
            { name: 'sync-meilisearch-index', schedule: 'Daily 02:00 UTC', description: 'Syncs college data into Meilisearch for typo-tolerant instant search (noop if MEILISEARCH_URL not set)' },
        ]
    });
});

router.post("/jobs/trigger/:jobName", async (req, res) => {
    try {
        const { jobName } = req.params;
        const result = await scheduler.triggerJob(jobName);
        res.json({ success: true, jobName, result });
    } catch (error) {
        const status = error.message.startsWith('Unknown job') ? 400 : 500;
        res.status(status).json({ error: error.message });
    }
});

// ── Search Management ─────────────────────────────────────────────────────────

router.get("/search-metrics", async (req, res) => {
    try {
        const { getProviderInfo } = require("../services/searchService");
        res.json(getProviderInfo());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/search/reindex", async (req, res) => {
    try {
        const result = await scheduler.triggerJob('sync-meilisearch-index');
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── System Status ─────────────────────────────────────────────────────────────

router.get("/system/status", async (req, res) => {
    try {
        const { getRedisClient } = require("../config/redis");
        const mongoose = require("mongoose");

        const mongoState = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
        let redisStatus = 'unavailable';
        try {
            const redis = await getRedisClient();
            if (redis) {
                await redis.ping();
                redisStatus = 'connected';
            }
        } catch { redisStatus = 'error'; }

        const memUsage = process.memoryUsage();

        res.json({
            status: 'operational',
            timestamp: new Date().toISOString(),
            admin: req.admin.email,
            services: {
                mongodb: mongoState,
                redis: redisStatus,
            },
            process: {
                uptime: Math.floor(process.uptime()),
                memHeapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(1),
                memHeapTotalMB: (memUsage.heapTotal / 1024 / 1024).toFixed(1),
                nodeVersion: process.version,
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Reviews Management ────────────────────────────────────────────────────────

router.get("/reviews", async (req, res) => {
    try {
        const Review = require("../models/Review");
        const { page = 1, limit = 50, status } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const filter = status && status !== 'all' ? { status } : {};

        const [reviews, total] = await Promise.all([
            Review.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip).limit(parseInt(limit))
                .lean(),
            Review.countDocuments(filter),
        ]);

        res.json({ reviews, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch("/reviews/:id/status", async (req, res) => {
    try {
        const Review = require("../models/Review");
        const { id } = req.params;
        const { status } = req.body;

        if (!["pending", "approved", "rejected"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const review = await Review.findByIdAndUpdate(id, { status }, { new: true });
        res.json({ success: true, review });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete("/reviews/:id", async (req, res) => {
    try {
        const Review = require("../models/Review");
        await Review.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Trust Reports ─────────────────────────────────────────────────────────────

router.get("/reports", async (req, res) => {
    try {
        const { status = 'pending', page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const filter = status === 'all' ? {} : { status };
        const [reports, total] = await Promise.all([
            TrustReport.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip).limit(parseInt(limit))
                .lean(),
            TrustReport.countDocuments(filter),
        ]);

        res.json({ reports, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch("/report/:id/resolve", async (req, res) => {
    try {
        const { id } = req.params;
        const { outcome, reviewNote } = req.body;

        if (!['validated', 'rejected'].includes(outcome)) {
            return res.status(400).json({ error: 'outcome must be "validated" or "rejected"' });
        }

        const rp = require('../lib/reportProcessor');
        const result = await rp.resolveReport(id, outcome, req.admin?.uid);
        if (reviewNote) {
            await TrustReport.findByIdAndUpdate(id, { reviewNote, reviewedBy: req.admin.email });
        }

        res.json({ message: `Report ${outcome}.`, reportId: id, outcome, updatedTrustScore: result.updatedTrustScore });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Ranking Cache Monitor ─────────────────────────────────────────────────────

router.get("/ranking-cache", async (req, res) => {
    try {
        const { getRedisClient } = require("../config/redis");
        const redis = await getRedisClient();
        if (!redis) return res.json({ available: false });

        const keys = await redis.keys('ranking:*');
        res.json({
            available: true,
            totalKeys: keys.length,
            keyBreakdown: {
                global: keys.filter(k => k.startsWith('ranking:global')).length,
                state: keys.filter(k => k.startsWith('ranking:state')).length,
                tier: keys.filter(k => k.startsWith('ranking:tier')).length,
                band: keys.filter(k => k.startsWith('ranking:band')).length,
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Anomalies ─────────────────────────────────────────────────────────────────

router.get("/anomalies", async (req, res) => {
    try {
        const Anomaly = require('../models/AnomalyAlert');
        const { page = 1, limit = 50, status } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const filter = status && status !== 'all' ? { status } : { zScore: { $ne: null } };

        const [alerts, total] = await Promise.all([
            Anomaly.find(filter).sort({ detectedAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
            Anomaly.countDocuments(filter),
        ]);

        // Map for frontend compatibility
        const anomalies = alerts.map(a => ({
            ...a,
            anomalyScore: a.zScore ? Math.abs(a.zScore * 20) : 0, // Mocked until formal score is added
            anomalyType: a.alertType,
        }));

        res.json({ anomalies, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Audit Log ─────────────────────────────────────────────────────────────────

router.get("/audit-log", async (req, res) => {
    try {
        const { page = 1, limit = 100 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const logs = await AdminAuditLog.find({})
            .sort({ timestamp: -1 })
            .skip(skip).limit(parseInt(limit))
            .lean();
        res.json({ logs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Whoami ───────────────────────────────────────────────────────────────────

router.get("/me", (req, res) => {
    res.json({
        email: req.admin.email,
        name: req.admin.name,
        picture: req.admin.picture,
        uid: req.admin.uid,
    });
});

// ── Dashboard Stats — Real live data, zero fake numbers ──────────────────────

router.get("/dashboard/stats", async (req, res) => {
    try {
        const now = new Date();
        const since24h = new Date(now - 24 * 60 * 60 * 1000);
        const since48h = new Date(now - 48 * 60 * 60 * 1000);

        // Load all models lazily (some may not exist in all envs)
        let Anomaly;
        try { Anomaly = require('../models/AnomalyAlert'); } catch { }

        // Parallel real DB queries
        const [
            totalColleges,
            pendingReports,
            prev24hReports,
            openAnomalies,
            auditLast24h,
            auditPrev24h,
            recentAuditLogs,
        ] = await Promise.all([
            College.countDocuments().lean(),
            TrustReport.countDocuments({ status: 'pending' }),
            TrustReport.countDocuments({ status: 'pending', createdAt: { $gte: since48h, $lt: since24h } }),
            Anomaly ? Anomaly.countDocuments({ status: 'open' }) : 0,
            AdminAuditLog.countDocuments({ timestamp: { $gte: since24h } }),
            AdminAuditLog.countDocuments({ timestamp: { $gte: since48h, $lt: since24h } }),
            AdminAuditLog.find({ timestamp: { $gte: since24h } })
                .sort({ timestamp: -1 }).limit(200).lean(),
        ]);

        // Build hourly bucket chart data (last 24h, 1h buckets)
        const hourBuckets = Array.from({ length: 24 }, (_, i) => {
            const bucketStart = new Date(now - (23 - i) * 60 * 60 * 1000);
            const bucketEnd = new Date(bucketStart.getTime() + 60 * 60 * 1000);
            const count = recentAuditLogs.filter(l => {
                const t = new Date(l.timestamp);
                return t >= bucketStart && t < bucketEnd;
            }).length;
            return {
                time: bucketStart.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                actions: count,
            };
        });

        // Recent unique page routes (from audit log — what admins were looking at)
        const recentActivity = recentAuditLogs.slice(0, 20).map(l => ({
            action: l.action,
            resource: l.resource,
            adminEmail: l.adminEmail,
            timestamp: l.timestamp,
            method: l.method,
        }));

        // Redis cache stats
        let cacheHitRate = null;
        try {
            const { getRedisClient } = require('../config/redis');
            const redis = await getRedisClient();
            if (redis) {
                const info = await redis.info('stats');
                const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || 0);
                const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || 0);
                const total = hits + misses;
                cacheHitRate = total > 0 ? ((hits / total) * 100).toFixed(1) : null;
            }
        } catch { }

        res.json({
            kpis: {
                totalColleges,
                pendingReports,
                pendingReportsDelta: pendingReports - prev24hReports,   // +N means more in queue
                openAnomalies,
                adminActions24h: auditLast24h,
                adminActionsDelta: auditLast24h - auditPrev24h,
                cacheHitRate,
            },
            chart: hourBuckets,
            recentActivity,
            generatedAt: now.toISOString(),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
