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
 
 /**
  * CEI Deterministic Ranking Engine (V2)
  * ======================================
  * Priority:
  *   1. isCore = true
  *   2. institutionStrengthScore / ceiScore (descending)
  *   3. Exact prefix match on name or shortName (for specific queries like "IIT")
  *   4. Original order (relevance/text score)
  */
 function rankResults(results, query) {
     if (!results || results.length === 0) return [];
     const q = (query || "").toLowerCase().trim();
 
     return [...results].sort((a, b) => {
         // 1. isCore Priority (Primary)
         const aCore = a.isCore === true || a.isCore === 'true' || a.isCore === 1;
         const bCore = b.isCore === true || b.isCore === 'true' || b.isCore === 1;
         if (aCore !== bCore) {
             return aCore ? -1 : 1;
         }
 
         // 2. Confidence & Score Priority (Strategic Tiering)
         let aScore = a.institutionStrengthScore || a.ceiScore || 0;
         let bScore = b.institutionStrengthScore || b.ceiScore || 0;

         // --- IDENTITY CONFIDENCE GATING (Phase 107) ---
         const aConf = a.identity?.confidence || 'LOW';
         const bConf = b.identity?.confidence || 'LOW';

         if (aConf === 'HIGH') aScore += 100;
         if (bConf === 'HIGH') bScore += 100;
         if (aConf === 'LOW') aScore -= 50;
         if (bConf === 'LOW') bScore -= 50;

         if (aScore !== bScore) {
             return bScore - aScore;
         }
 
         // 3. Exact Prefix Match Priority (Relevance boost)
         if (q.length > 1) {
             const aName = (a.name || a.institution_name || "").toLowerCase();
             const aShort = (a.shortName || "").toLowerCase();
             const bName = (b.name || b.institution_name || "").toLowerCase();
             const bShort = (b.shortName || "").toLowerCase();
 
             const aPrefix = aName.startsWith(q) || aShort.startsWith(q);
             const bPrefix = bName.startsWith(q) || bShort.startsWith(q);
 
             if (aPrefix !== bPrefix) {
                 return aPrefix ? -1 : 1;
             }
         }
 
         // 4. Alphabetical Fallback
         const aTitle = a.name || a.institution_name || "";
         const bTitle = b.name || b.institution_name || "";
         return aTitle.localeCompare(bTitle);
     });
 }
 
 /**
  * CEI Search Intent Filter
  * ========================
  * Strictly isolates results when a specific institutional intent (IIT, NIT, IIIT) is detected.
  * Rejects polluters (KIIT, IITM, etc.) while preserving the intended cohort.
  */
 function applyIntentFilter(results, query) {
     if (!results || results.length === 0) return [];
     const q = (query || "").toLowerCase().trim();
 
     // Word-bound detection to avoid misfiring on sub-strings (e.g., "KIIT" contains "iit")
     const isIIT = /\biit\b/.test(q) || q.includes("indian institute of technology");
     const isNIT = /\bnit\b/.test(q) || q.includes("national institute of technology");
     const isIIIT = /\biiit\b/.test(q) || q.includes("indian institute of information technology");
 
     if (!isIIT && !isNIT && !isIIIT) return results;
 
     return results.filter(r => {
         const name = (r.name || r.institution_name || "").toLowerCase();
         const shortName = (r.shortName || "").toLowerCase();
 
         if (isIIT) {
             // 1. Primary Rejections (The "Polluters")
             if (name.includes("information") || name.includes("international") || name.includes("kiit") || name.includes("iitm")) {
                 return false;
             }
             // 2. Positive Matches
             const matchesName = name.startsWith("indian institute of technology");
             const matchesShort = /^iit($| )/.test(shortName);
             return matchesName || matchesShort;
         }
 
         if (isNIT) {
             const isRealNIT = name.includes("national institute of technology") || 
                               (r.id || "").startsWith("CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY") ||
                               (r.institution_id || "").startsWith("CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY");
                               
             const isPolluter = name.includes("polytechnic") || name.includes("management") || 
                                name.includes("school") || name.includes("graduate") ||
                                name.includes("information technology") || name.includes("iit");
             return isRealNIT && !isPolluter;
         }
 
         if (isIIIT) {
             return name.includes("indian institute of information technology") || /^iiit($| )/.test(shortName);
         }
 
         return true;
     });
 }

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
            limit: Math.max(limit * 3, 60), // Fetch more for re-ranking
            filter: filterParts.length ? filterParts.join(' AND ') : undefined,
            attributesToRetrieve: ['id', 'name', 'shortName', 'institution_name', 'state', 'rankingTier', 'competitivenessBand', 'ceiScore', 'institutionStrengthScore', 'isCore', 'location'],
            attributesToHighlight: ['name', 'shortName', 'location'],
            highlightPreTag: '<mark>',
            highlightPostTag: '</mark>',
        });
 
        metrics.meili_searches++;
        const filtered = applyIntentFilter(result.hits, q);
        const ranked = rankResults(filtered, q);
        return ranked.slice(0, limit);
    } catch (err) {
        logger.warn('[SearchService] Meilisearch query error', { error: err.message });
        return null; // Triggers Mongo fallback
    }
}

// ── MongoDB Fallback Search ───────────────────────────────────────────────────

async function searchViaMongo(q, { limit = 20, filters = {} } = {}) {
    const College = require('../models/CollegeSchema');

    const mongoFilters = { isVisible: { $ne: false } };
    if (filters.state) mongoFilters.state = filters.state;
    if (filters.tier) mongoFilters.rankingTier = filters.tier;
    if (filters.band) mongoFilters.competitivenessBand = filters.band;

    // [CEI] Phase 1: Attempt $text index search (fast, ranked by relevance score)
    // Isolated in its own try/catch so a missing text index does NOT abort the function.
    try {
        const textResults = await College.find(
            { $text: { $search: q }, ...mongoFilters },
            { 
                score: { $meta: 'textScore' }, 
                isCore: 1, institutionStrengthScore: 1, ceiScore: 1, 
                id: 1, name: 1, shortName: 1, institution_name: 1, state: 1, 
                rankingTier: 1, location: 1 
            }
        )
            .sort({ score: { $meta: 'textScore' } })
            .limit(Math.max(limit * 3, 100))
            .lean();

        if (textResults.length > 0) {
            metrics.mongo_searches++;
            const filtered = applyIntentFilter(textResults, q);
            const ranked = rankResults(filtered, q);
            return ranked.slice(0, limit).map(r => ({ ...r, id: r.id || (r._id ? r._id.toString() : '') }));
        }
    } catch (textErr) {
        // Expected: "text index required for $text query" when no text index exists.
        // Log at debug level only — do NOT return, fall through to regex path.
        logger.info && logger.info('[SearchService] $text search unavailable, using regex fallback', { reason: textErr.message });
    }

    // [CEI] Phase 2: Deterministic regex search across all identity-bearing fields.
    // Covers: name, shortName, institution_name, id, institution_id, stableKey.
    // No fuzzy matching — substring match only.
    try {
        const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(safeQ, 'i');
        const initialRegex = new RegExp('^' + q.split('').join('.*'), 'i');

        const regexResults = await College.find(
            {
                $or: [
                    { id: { $regex: regex } },
                    { institution_id: { $regex: regex } },
                    { stableKey: { $regex: regex } },
                    { name: { $regex: regex } },
                    { shortName: { $regex: regex } },
                    { institution_name: { $regex: regex } },
                    { name: { $regex: initialRegex } }
                ],
                ...mongoFilters
            },
            // [CEI] _id: 0 prevents Mongoose's .id virtual from overriding the canonical 'id' string field
            { _id: 0, id: 1, institution_id: 1, isCore: 1, institutionStrengthScore: 1, ceiScore: 1, name: 1, shortName: 1, institution_name: 1, stableKey: 1, state: 1, rankingTier: 1, location: 1 }
        )
            .limit(Math.max(limit * 3, 100))
            .lean();

        metrics.mongo_searches++;
        
        const filtered = applyIntentFilter(regexResults, q);
        const ranked = rankResults(filtered, q);
        
        // [CEI] canonical ID priority: institution_id → id → fallback empty
        return ranked.slice(0, limit).map(r => ({
            ...r,
            id: r.institution_id || r.id || ''
        }));

    } catch (err) {
        logger.warn('[SearchService] MongoDB regex search error', { error: err.message });
        return [];
    }
}


// ── Memory Fallback Search (NDJSON) ──────────────────────────────────────────

async function searchViaMemory(q, { limit = 20, filters = {} } = {}) {
    if (!global.colleges || global.colleges.length === 0) return [];

    const qLower = q.toLowerCase();

    const results = global.colleges.filter(c => {
        // [CEI] Exclude hidden/shell nodes from search results
        if (c.isVisible === false) return false;

        // [CEI] Search all identity-bearing fields deterministically.
        // Covers: id, institution_id, stableKey, name, shortName, institution_name.
        // No fuzzy matching — substring only.
        const match = (
            (c.name || "").toLowerCase().includes(qLower) ||
            (c.shortName || "").toLowerCase().includes(qLower) ||
            (c.institution_name || "").toLowerCase().includes(qLower) ||
            (c.id || "").toLowerCase().includes(qLower) ||
            (c.institution_id || "").toLowerCase().includes(qLower) ||
            (c.stableKey || "").toLowerCase().includes(qLower)
        );

        if (!match) return false;

        // Apply filters
        if (filters.state && c.state !== filters.state) return false;
        if (filters.tier && c.rankingTier !== filters.tier) return false;
        if (filters.band && c.competitivenessBand !== filters.band) return false;

        return true;
    });

    // Filter by Intent
    const filtered = applyIntentFilter(results, q);
 
    // Rank using deterministic engine
    const ranked = rankResults(filtered, q);
 
    return ranked
        .slice(0, limit)
        .map(r => ({ ...r, id: String(r.id || r._id) }));
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

    const originalQ = q.trim().substring(0, 100);
    let term = originalQ;
    const qLower = term.toLowerCase();

    // [CEI] Query Expansion: Acronym -> Full Name for better Recall
    if (/\bnit\b/.test(qLower)) {
        term = "National Institute of Technology";
    } else if (/\biit\b/.test(qLower)) {
        term = "Indian Institute of Technology";
    } else if (/\biiit\b/.test(qLower)) {
        term = "Indian Institute of Information Technology";
    }

    const { limit = 20, filters = {} } = options;

    // Cache key includes filters so different facet combinations don't pollide
    // [CEI] We cache by original query to ensure deterministic expansion behavior
    const cacheKey = `search:v3:${JSON.stringify({ term: originalQ, limit, filters })}`;
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

    // Try Meilisearch → fall back to MongoDB → fall back to Memory
    let results = await searchViaMeili(term, { limit, filters });
    if (!results) {
        results = await searchViaMongo(term, { limit, filters });
    }
    if (!results || results.length === 0) {
        results = await searchViaMemory(term, { limit, filters });
    }

    // Cache results
    if (redis && results.length > 0) {
        redis.set(cacheKey, JSON.stringify(results), 'EX', 120).catch((err) => {
            if (!err.message.includes("quota exceeded") && !err.message.includes("limit exceeded")) {
                logger.warn('[SearchService] Cache set error', { error: err.message });
            }
        });
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
    return results.map(r => {
        // [CEI] Full name priority chain — covers all source shapes:
        //   CORE institutions: r.name is populated
        //   AICTE/MongoDB records: only r.institution_name is populated (name/shortName absent)
        //   Memory (NDJSON) records: r.name populated, r.shortName may differ
        const displayName =
            r.name ||
            r.institution_name ||
            r.shortName ||
            r.fullName ||
            r.title ||
            null;

        return {
            id: r.institution_id || r.id,
            name: displayName,
            fullName: displayName,
            location: r.location || r.state || null,
            type: r.type || 'college',
        };
    }).filter(r => r.id && r.name); // [CEI] Drop results with no id or no name — not safe to surface
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
    applyIntentFilter,
    rankResults,
};
