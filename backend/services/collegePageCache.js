/**
 * services/collegePageCache.js — College Page Aggregation Cache
 * ==============================================================
 * Precomputes a single enriched JSON payload per college, aggregating
 * data from multiple models into one Redis key.
 *
 * KEY SCHEMA:
 *   college:page:{collegeId}    → full page payload
 *   college:page:meta:lastBuilt → ISO timestamp of last full rebuild
 *
 * PAYLOAD:
 *   { college, placements, verification, anomalies, integrity, meta }
 *
 * TTL: 6 hours (scheduler rebuilds every 6h)
 *
 * USAGE:
 *   const page = await getCollegePage(id);   // Redis → Mongo fallback
 *   await invalidateCollegePage(id);          // Called on admin write
 *   await rebuildAll();                       // Called by scheduler
 */

'use strict';

const { getRedisClient } = require('../config/redis');
const College = require('../models/CollegeSchema');
const logger = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// ── Constants ─────────────────────────────────────────────────────────────────

const TTL = 6 * 60 * 60;           // 6 hours
const PAGE_KEY = (id) => `college:page:${id}`;
const BATCH_SIZE = 200;             // Mongo batch size for full rebuild

// Optional models (fail gracefully if not present)
const safeRequire = (path) => { try { return require(path); } catch { return null; } };
const AnomalyLog = safeRequire('../models/AnomalyLog');
const IntegrityScore = safeRequire('../models/IntegrityScore');
const VerificationLog = safeRequire('../models/VerificationLog');
const TrustReport = safeRequire('../models/TrustReport');

// ── Metrics ───────────────────────────────────────────────────────────────────

const metrics = { hits: 0, misses: 0, last_build_ms: 0, last_built_count: 0 };

// ── Compose one page payload ──────────────────────────────────────────────────

/**
 * assemblePagePayload(college)
 *
 * Fetches supplementary data for a college and merges into a single object.
 * Each supplementary query is wrapped individually so failures don't abort the page.
 */
async function assemblePagePayload(college) {
    const id = college.id || college._id?.toString();

    const [anomalies, integrity, verifications, trustReports] = await Promise.all([
        AnomalyLog
            ? AnomalyLog.find({ collegeId: id, status: 'open' }).sort({ createdAt: -1 }).limit(10).lean().catch(() => [])
            : Promise.resolve([]),
        IntegrityScore
            ? IntegrityScore.findOne({ collegeId: id }).lean().catch(() => null)
            : Promise.resolve(null),
        VerificationLog
            ? VerificationLog.find({ collegeId: id }).sort({ verifiedAt: -1 }).limit(5).lean().catch(() => [])
            : Promise.resolve([]),
        TrustReport
            ? TrustReport.find({ collegeId: id, status: 'resolved' }).sort({ resolvedAt: -1 }).limit(3).lean().catch(() => [])
            : Promise.resolve([]),
    ]);

    return {
        college,
        anomalies,
        integrity,
        verifications,
        trustReports,
        meta: {
            assembledAt: new Date().toISOString(),
            hasOpenAnomalies: anomalies.length > 0,
            integrityScore: integrity?.overallScore ?? null,
            verifiedFields: verifications.length,
        },
    };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * getCollegePage(id)
 *
 * Returns the full page payload for a college.
 * Cache hit → Redis (5-15ms)
 * Cache miss → assembles from MongoDB and caches for next request
 */
async function getCollegePage(id) {
    const redis = await getRedisClient();

    if (redis) {
        try {
            const raw = await redis.get(PAGE_KEY(id));
            if (raw) {
                metrics.hits++;
                return JSON.parse(raw);
            }
        } catch (err) {
            logger.warn('[CollegePageCache] GET error', { id, error: err.message });
        }
    }

    metrics.misses++;

    // Mongo fallback
    let mongoQuery;
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
        mongoQuery = { $or: [{ _id: id }, { id }] };
    } else {
        mongoQuery = { id };
    }

    const college = await College.findOne(mongoQuery).lean();
    if (!college) return null;

    const payload = await assemblePagePayload(college);

    // Write-through: cache result for next request
    if (redis) {
        redis.set(PAGE_KEY(id), JSON.stringify(payload), 'EX', TTL).catch(() => { });
    }

    return payload;
}

/**
 * invalidateCollegePage(id)
 *
 * Deletes the cached page for a single college.
 * Called immediately on any admin write affecting this college.
 */
async function invalidateCollegePage(id) {
    const redis = await getRedisClient();
    if (!redis) return;
    try {
        await redis.del(PAGE_KEY(id));
        logger.info(`[CollegePageCache] Invalidated page for ${id}`);
    } catch (err) {
        logger.warn('[CollegePageCache] Invalidation error', { id, error: err.message });
    }
}

/**
 * rebuildAll()
 *
 * Rebuilds page cache for every college. Runs in batches of 200
 * to avoid loading 68k records into memory simultaneously.
 * Called by the scheduler every 6h.
 */
async function rebuildAll() {
    const start = Date.now();
    const redis = await getRedisClient();

    if (!redis) {
        logger.warn('[CollegePageCache] Redis unavailable — skipping rebuild');
        return { built: 0, durationMs: 0, skipped: true };
    }

    logger.info('[CollegePageCache] Starting full page cache rebuild...');

    let built = 0;
    let cursor = null;
    let totalColleges = 0;

    // Count first so we can log progress
    totalColleges = await College.countDocuments({});
    logger.info(`[CollegePageCache] Total colleges to precompute: ${totalColleges}`);

    // Stream all colleges in lean batches using skip/limit pagination
    const pages = Math.ceil(totalColleges / BATCH_SIZE);

    for (let page = 0; page < pages; page++) {
        const batch = await College.find({}, { id: 1, name: 1, state: 1, rankingTier: 1, competitivenessBand: 1 })
            .skip(page * BATCH_SIZE)
            .limit(BATCH_SIZE)
            .lean();

        // For each college in batch, check if key exists (skip if already cached)
        const pipeline = redis.pipeline();
        batch.forEach(c => pipeline.exists(PAGE_KEY(c.id)));
        const existsResults = await pipeline.exec();

        // Only assemble payload for colleges missing from cache
        const toBuild = batch.filter((c, i) => existsResults[i][1] === 0);

        await Promise.all(
            toBuild.map(async (col) => {
                try {
                    const fullCollege = await College.findOne({ id: col.id }).lean();
                    if (!fullCollege) return;
                    const payload = await assemblePagePayload(fullCollege);
                    await redis.set(PAGE_KEY(col.id), JSON.stringify(payload), 'EX', TTL);
                    built++;
                } catch (err) {
                    logger.warn(`[CollegePageCache] Failed to build page for ${col.id}`, { error: err.message });
                }
            })
        );

        if ((page + 1) % 10 === 0) {
            logger.info(`[CollegePageCache] Progress: ${Math.min((page + 1) * BATCH_SIZE, totalColleges)}/${totalColleges}`);
        }
    }

    const durationMs = Date.now() - start;
    metrics.last_build_ms = durationMs;
    metrics.last_built_count = built;

    await redis.set('college:page:meta:lastBuilt', new Date().toISOString(), 'EX', TTL + 3600);
    await redis.set('college:page:meta:buildDurationMs', String(durationMs), 'EX', TTL + 3600);

    logger.info(`[CollegePageCache] ✅ Rebuild complete. Built: ${built}, Skipped (warm): ${totalColleges - built}, Duration: ${durationMs}ms`);

    return { built, skipped: totalColleges - built, durationMs };
}

async function getStatus() {
    const redis = await getRedisClient();
    if (!redis) return { status: 'redis_unavailable', metrics };
    const [lastBuilt, buildMs] = await Promise.all([
        redis.get('college:page:meta:lastBuilt'),
        redis.get('college:page:meta:buildDurationMs'),
    ]);
    return {
        status: 'ok',
        lastBuilt: lastBuilt || null,
        lastBuildDurationMs: buildMs ? parseInt(buildMs) : null,
        metrics: { ...metrics },
    };
}

module.exports = {
    getCollegePage,
    invalidateCollegePage,
    rebuildAll,
    getStatus,
    PAGE_KEY,
};
