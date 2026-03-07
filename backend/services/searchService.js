/**
 * services/searchService.js — CEI Unified Search Service
 * ========================================================
 * Provides a unified search interface that supports two backends:
 *
 *   1. Meilisearch (preferred) — 5ms typo-tolerant search
 *   2. MongoDB $text index (fallback) — ~30ms, good enough for now
 *
 * Backend selection is automatic:
 *   - If MEILISEARCH_URL env var is set → Meilisearch
 *   - Otherwise → MongoDB fallback
 *
 * SETUP (Meilisearch):
 *   1. Install: docker run -p 7700:7700 getmeili/meilisearch:latest
 *   2. Set env: MEILISEARCH_URL=http://localhost:7700
 *   3. Set env: MEILISEARCH_KEY=your-master-key (optional)
 *   4. Sync index: node scripts/meiliSync.js (or trigger via admin API)
 *
 * KEY FEATURES:
 *   - Typo tolerance (search "IIT Bomaby" → finds "IIT Bombay")
 *   - Prefix search (search "iit" → instant prefix hits)
 *   - Faceted filtering (state, tier, band)
 *   - Ranking boost by ceiScore
 */

'use strict';

const { getRedisClient } = require('../config/redis');
const logger = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// ── Provider detection ────────────────────────────────────────────────────────

const MEILI_URL = process.env.MEILISEARCH_URL;
const MEILI_KEY = process.env.MEILISEARCH_KEY || '';
const MEILI_INDEX = 'colleges';

let meiliClient = null;

async function getMeiliClient() {
    if (!MEILI_URL) return null;
    if (meiliClient) return meiliClient;

    try {
        const { MeiliSearch } = require('meilisearch');
        meiliClient = new MeiliSearch({ host: MEILI_URL, apiKey: MEILI_KEY });
        // Health check
        await meiliClient.health();
        logger.info('[SearchService] Meilisearch connected');
        return meiliClient;
    } catch (err) {
        // Meilisearch not running or package not installed — fall back silently
        logger.info('[SearchService] Meilisearch unavailable, using MongoDB fallback', { reason: err.message });
        meiliClient = null;
        return null;
    }
}

// ── Metrics ───────────────────────────────────────────────────────────────────

const metrics = {
    meili_searches: 0,
    mongo_searches: 0,
    cache_hits: 0,
};

function getMetrics() { return { ...metrics, provider: MEILI_URL ? 'meilisearch' : 'mongodb' }; }

// ── Meilisearch Search ────────────────────────────────────────────────────────

async function searchViaMeili(q, { limit = 20, filters = {} } = {}) {
    const client = await getMeiliClient();
    if (!client) return null;

    try {
        const index = client.index(MEILI_INDEX);

        // Build filter expression from facets
        const filterParts = [];
        if (filters.state) filterParts.push(`state = "${filters.state}"`);
        if (filters.tier) filterParts.push(`rankingTier = "${filters.tier}"`);
        if (filters.band) filterParts.push(`competitivenessBand = "${filters.band}"`);

        const result = await index.search(q, {
            limit,
            filter: filterParts.length ? filterParts.join(' AND ') : undefined,
            attributesToRetrieve: ['id', 'name', 'shortName', 'state', 'rankingTier', 'competitivenessBand', 'ceiScore', 'location'],
            attributesToHighlight: ['name', 'shortName', 'location'],
            highlightPreTag: '<mark>',
            highlightPostTag: '</mark>',
        });

        metrics.meili_searches++;
        return result.hits;
    } catch (err) {
        logger.warn('[SearchService] Meilisearch query error', { error: err.message });
        return null; // Triggers Mongo fallback
    }
}

// ── MongoDB Fallback Search ───────────────────────────────────────────────────

async function searchViaMongo(q, { limit = 20, filters = {} } = {}) {
    const College = require('../models/CollegeSchema');

    const mongoFilters = {};
    if (filters.state) mongoFilters.state = filters.state;
    if (filters.tier) mongoFilters.rankingTier = filters.tier;
    if (filters.band) mongoFilters.competitivenessBand = filters.band;

    try {
        // Try $text index first
        const results = await College.find(
            { $text: { $search: q }, ...mongoFilters },
            { score: { $meta: 'textScore' }, id: 1, name: 1, shortName: 1, state: 1, rankingTier: 1, ceiScore: 1, location: 1 }
        )
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit)
            .lean();

        if (results.length > 0) {
            metrics.mongo_searches++;
            return results.map(r => ({ ...r, id: r._id ? r._id.toString() : r.id }));
        }

        // If $text misses (short query), try prefix regex on name
        const regex = { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' };
        const prefixResults = await College.find(
            { $or: [{ name: regex }, { shortName: regex }], ...mongoFilters },
            { id: 1, name: 1, shortName: 1, state: 1, rankingTier: 1, ceiScore: 1, location: 1 }
        )
            .limit(limit)
            .lean();

        metrics.mongo_searches++;
        return prefixResults.map(r => ({ ...r, id: r._id ? r._id.toString() : r.id }));
    } catch (err) {
        logger.warn('[SearchService] MongoDB search error', { error: err.message });
        return [];
    }
}

// ── Unified Search Interface ─────────────────────────────────────────────────

/**
 * search(q, options)
 *
 * Main search entry point. Tries Meilisearch first, falls back to MongoDB.
 * Results are cached in Redis for 120 seconds.
 *
 * @param {string} q           — search query
 * @param {object} options     — { limit, filters: { state, tier, band } }
 * @returns {Array}            — array of college objects
 */
async function search(q, options = {}) {
    if (!q || q.trim().length === 0) return [];

    const term = q.trim().substring(0, 100);
    const { limit = 20, filters = {} } = options;

    // Cache key includes filters so different facet combinations don't pollide
    const cacheKey = `search:v2:${JSON.stringify({ term, limit, filters })}`;
    const redis = await getRedisClient();

    if (redis) {
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                metrics.cache_hits++;
                return JSON.parse(cached);
            }
        } catch { /* ignore cache errors */ }
    }

    // Try Meilisearch → fall back to MongoDB
    let results = await searchViaMeili(term, { limit, filters });
    if (!results) {
        results = await searchViaMongo(term, { limit, filters });
    }

    // Cache results
    if (redis && results.length > 0) {
        redis.set(cacheKey, JSON.stringify(results), 'EX', 120).catch(() => { });
    }

    return results;
}

/**
 * suggest(q, options)
 *
 * Lightweight typeahead that returns only id/name/location.
 * 60 second cache TTL.
 */
async function suggest(q, options = {}) {
    const results = await search(q, { ...options, limit: 8 });
    return results.map(r => ({
        id: r.id,
        name: r.shortName || r.name,
        fullName: r.name,
        location: r.location || null,
        type: 'college',
    }));
}

// ── Provider Info ─────────────────────────────────────────────────────────────

function getProviderInfo() {
    return {
        provider: MEILI_URL ? 'meilisearch' : 'mongodb',
        meiliUrl: MEILI_URL || null,
        indexName: MEILI_INDEX,
        metrics: getMetrics(),
    };
}

module.exports = {
    search,
    suggest,
    getMeiliClient,
    getProviderInfo,
    getMetrics,
    MEILI_INDEX,
};
