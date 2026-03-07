/**
 * services/rankingCacheBuilder.js — CEI Ranking Cache Engine
 * =============================================================
 * Precomputes and stores top-200 ranking lists in Redis.
 *
 * KEY SCHEMA:
 *   ranking:global:ceiScore          → top 200 by CEI score across all colleges
 *   ranking:global:placement          → top 200 by highest package
 *   ranking:state:{state}:ceiScore    → top 200 for a state by score
 *   ranking:state:{state}:placement   → top 200 for a state by placement
 *   ranking:tier:{tier}:ceiScore      → top 200 for a tier by score
 *   ranking:band:{band}:placement     → top 200 for a band by placement
 *   ranking:meta:lastBuilt            → ISO timestamp of last full rebuild
 *
 * VALUE FORMAT: JSON.stringify([{ collegeId, name, state, rankingTier,
 *   competitivenessBand, ceiScore, highestPackage, shortName }])
 *
 * TTL: 13 hours (slightly longer than the 12h rebuild schedule to avoid gaps)
 */

'use strict';

const College = require('../models/CollegeSchema');
const { getRedisClient } = require('../config/redis');
const logger = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// ── Constants ─────────────────────────────────────────────────────────────────

const RANKING_TTL = 13 * 60 * 60; // 13 hours in seconds
const TOP_N = 200;                  // Precompute top 200 per dimension

// Canonical dimension definitions — source of truth for key generation
const STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const TIERS = ['Tier 1', 'Tier 2', 'Tier 3', 'Stand Alone', 'University'];
const BANDS = ['Elite', 'High', 'Competitive', 'Moderate', 'Emerging'];

// Minimal projection — keeps Redis values small and network transfer fast
const RANKING_PROJECTION = {
    id: 1, name: 1, shortName: 1, state: 1, rankingTier: 1,
    competitivenessBand: 1, ceiScore: 1,
    'placements.highestPackageNumeric': 1,
    _id: 0
};

// ── Metrics (in-process counters) ─────────────────────────────────────────────

const metrics = {
    cache_hits: 0,
    cache_misses: 0,
    last_build_time_ms: 0,
};

function getMetrics() { return { ...metrics }; }

// ── Key Helpers ───────────────────────────────────────────────────────────────

function rankingKey(dimension, value, sortBy) {
    return `ranking:${dimension}:${value}:${sortBy}`;
}

/** Normalise state/tier/band values for consistent Redis keys */
function normalise(val) {
    return (val || '').trim();
}

// ── Transform MongoDB doc → compact ranking entry ─────────────────────────────

function toRankingEntry(doc) {
    return {
        collegeId: doc.id,
        name: doc.name,
        shortName: doc.shortName || null,
        state: doc.state || null,
        rankingTier: doc.rankingTier || null,
        competitivenessBand: doc.competitivenessBand || null,
        ceiScore: typeof doc.ceiScore === 'number' ? doc.ceiScore : null,
        highestPackage: doc.placements?.highestPackageNumeric ?? null,
    };
}

// ── Core: build and store one ranking key ─────────────────────────────────────

/**
 * buildOne(redis, filter, sortField, redisKey)
 *
 * Queries MongoDB with `filter`, sorts by `sortField` descending,
 * takes top 200, transforms, and stores JSON array in Redis.
 *
 * @returns {number} number of entries written
 */
async function buildOne(redis, filter, sortField, redisKey) {
    const mongoSort = {};
    mongoSort[sortField] = -1;

    const docs = await College.find(filter, RANKING_PROJECTION)
        .sort(mongoSort)
        .limit(TOP_N)
        .lean();

    if (docs.length === 0) return 0;

    const payload = JSON.stringify(docs.map(toRankingEntry));
    await redis.set(redisKey, payload, 'EX', RANKING_TTL);
    return docs.length;
}

// ── Full Rebuild Orchestrator ─────────────────────────────────────────────────

/**
 * rebuildAll()
 *
 * Builds every ranking cache dimension. Called by the scheduler every 12h
 * and can be triggered manually via the admin jobs API.
 *
 * @returns {{ keysBuilt, durationMs, breakdown }}
 */
async function rebuildAll() {
    const start = Date.now();
    const redis = await getRedisClient();

    if (!redis) {
        logger.warn('[RankingCache] Redis unavailable — skipping rebuild');
        return { keysBuilt: 0, durationMs: 0, breakdown: {}, skipped: true };
    }

    let keysBuilt = 0;
    const breakdown = {};

    logger.info('[RankingCache] Starting full ranking cache rebuild...');

    // ── Global rankings ───────────────────────────────────────────────────────
    logger.info('[RankingCache] Building global rankings...');
    const globalCeiCount = await buildOne(
        redis, { ceiScore: { $ne: null } },
        'ceiScore', 'ranking:global:ceiScore'
    );
    const globalPlacementCount = await buildOne(
        redis, { 'placements.highestPackageNumeric': { $gt: 0 } },
        'placements.highestPackageNumeric', 'ranking:global:placement'
    );
    breakdown.global = { ceiScore: globalCeiCount, placement: globalPlacementCount };
    keysBuilt += 2;

    // ── State rankings ────────────────────────────────────────────────────────
    logger.info(`[RankingCache] Building state rankings for ${STATES.length} states...`);
    let stateKeys = 0;
    for (const state of STATES) {
        const n = normalise(state);
        await buildOne(
            redis, { state: n, ceiScore: { $ne: null } },
            'ceiScore', rankingKey('state', n, 'ceiScore')
        );
        await buildOne(
            redis, { state: n, 'placements.highestPackageNumeric': { $gt: 0 } },
            'placements.highestPackageNumeric', rankingKey('state', n, 'placement')
        );
        stateKeys += 2;
    }
    breakdown.states = stateKeys;
    keysBuilt += stateKeys;

    // ── Tier rankings ─────────────────────────────────────────────────────────
    logger.info('[RankingCache] Building tier rankings...');
    let tierKeys = 0;
    for (const tier of TIERS) {
        await buildOne(
            redis, { rankingTier: tier, ceiScore: { $ne: null } },
            'ceiScore', rankingKey('tier', normalise(tier), 'ceiScore')
        );
        tierKeys++;
    }
    breakdown.tiers = tierKeys;
    keysBuilt += tierKeys;

    // ── Competitiveness band rankings ─────────────────────────────────────────
    logger.info('[RankingCache] Building band rankings...');
    let bandKeys = 0;
    for (const band of BANDS) {
        await buildOne(
            redis, {
            competitivenessBand: band,
            'placements.highestPackageNumeric': { $gt: 0 }
        },
            'placements.highestPackageNumeric',
            rankingKey('band', normalise(band), 'placement')
        );
        bandKeys++;
    }
    breakdown.bands = bandKeys;
    keysBuilt += bandKeys;

    // ── Stamp the last build time ─────────────────────────────────────────────
    const durationMs = Date.now() - start;
    await redis.set('ranking:meta:lastBuilt', new Date().toISOString(), 'EX', RANKING_TTL);
    await redis.set('ranking:meta:buildDurationMs', String(durationMs), 'EX', RANKING_TTL);

    metrics.last_build_time_ms = durationMs;

    logger.info(`[RankingCache] ✅ Rebuild complete. Keys: ${keysBuilt}, Duration: ${durationMs}ms`, { breakdown });

    return { keysBuilt, durationMs, breakdown };
}

// ── Read Interface (used by the colleges route) ───────────────────────────────

/**
 * getRanking(redisKey)
 *
 * Reads a precomputed ranking from Redis.
 * Returns null on cache miss or Redis error (caller handles fallback).
 */
async function getRanking(redisKey) {
    const redis = await getRedisClient();
    if (!redis) {
        metrics.cache_misses++;
        return null;
    }

    try {
        const raw = await redis.get(redisKey);
        if (!raw) {
            metrics.cache_misses++;
            return null;
        }
        metrics.cache_hits++;
        return JSON.parse(raw);
    } catch (err) {
        logger.warn('[RankingCache] GET error', { key: redisKey, error: err.message });
        metrics.cache_misses++;
        return null;
    }
}

/**
 * invalidateAll()
 *
 * Deletes all ranking:* keys using SCAN (non-blocking).
 * Called by admin routes on any college data write.
 */
async function invalidateAll() {
    const redis = await getRedisClient();
    if (!redis) return 0;

    let cursor = '0';
    let deleted = 0;

    try {
        do {
            const [next, keys] = await redis.scan(cursor, 'MATCH', 'ranking:*', 'COUNT', 200);
            cursor = next;
            if (keys.length > 0) {
                await redis.del(...keys);
                deleted += keys.length;
            }
        } while (cursor !== '0');

        logger.info(`[RankingCache] Invalidated ${deleted} ranking keys`);
        return deleted;
    } catch (err) {
        logger.warn('[RankingCache] Invalidation error', { error: err.message });
        return 0;
    }
}

/**
 * invalidateForCollege(collegeData)
 *
 * Surgical invalidation: only clears ranking keys that this college
 * could affect. Requires state, rankingTier, and competitivenessBand.
 */
async function invalidateForCollege(data) {
    if (!data) return 0;
    const redis = await getRedisClient();
    if (!redis) return 0;

    const { state, rankingTier, competitivenessBand } = data;
    const keys = [
        'ranking:global:ceiScore',
        'ranking:global:placement',
    ];

    if (state) {
        const nState = normalise(state);
        keys.push(rankingKey('state', nState, 'ceiScore'));
        keys.push(rankingKey('state', nState, 'placement'));
    }

    if (rankingTier) {
        keys.push(rankingKey('tier', normalise(rankingTier), 'ceiScore'));
    }

    if (competitivenessBand) {
        keys.push(rankingKey('band', normalise(competitivenessBand), 'placement'));
    }

    try {
        const count = await redis.del(...keys);
        logger.info(`[RankingCache] Surgically invalidated ${count} keys for ${data.id || 'unknown'}`);
        return count;
    } catch (err) {
        logger.warn('[RankingCache] Surgical invalidation error', { error: err.message });
        return 0;
    }
}

/**
 * buildOneAsync(filter, sortField, redisKey)
 *
 * Non-blocking background rebuild of a single ranking key.
 * Called after a cache miss so the next request gets a cache hit.
 */
async function buildOneAsync(filter, sortField, redisKey) {
    const redis = await getRedisClient();
    if (!redis) return;
    buildOne(redis, filter, sortField, redisKey).catch((err) => {
        logger.warn('[RankingCache] Async build error', { key: redisKey, error: err.message });
    });
}

// ── Status ────────────────────────────────────────────────────────────────────

async function getStatus() {
    const redis = await getRedisClient();
    if (!redis) return { status: 'redis_unavailable', metrics: getMetrics() };

    const [lastBuilt, buildMs] = await Promise.all([
        redis.get('ranking:meta:lastBuilt'),
        redis.get('ranking:meta:buildDurationMs'),
    ]);

    return {
        status: 'ok',
        lastBuilt: lastBuilt || null,
        lastBuildDurationMs: buildMs ? parseInt(buildMs) : null,
        metrics: getMetrics(),
    };
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
    rebuildAll,
    getRanking,
    invalidateAll,
    invalidateForCollege,
    buildOneAsync,
    getStatus,
    getMetrics,
    rankingKey,
    normalise,
    // Exposed for testing
    STATES,
    TIERS,
    BANDS,
    TOP_N,
};
