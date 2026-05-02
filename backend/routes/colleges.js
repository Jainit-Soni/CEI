const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const surfaceTierRegistry = require("../lib/surfaceTierRegistry");
const College = require("../models/CollegeSchema");
const cache = require("../services/cache");
const rankingCache = require("../services/rankingCacheBuilder");
const pageCache = require("../services/collegePageCache");
const VerifiedField = require("../models/VerifiedField");
const SourceEvidence = require("../models/SourceEvidence");
const dataStore = require("../services/dataStore");
const { getRedisClient } = require("../config/redis");
const { getCollegeTruthCourses } = require("../services/courseOfferingsReadService");
const normalizeCollege = require("../lib/collegeNormalizer");
const identityResolver = require("../lib/collegeIdentityResolver");
const { applyIntentFilter, rankResults } = require("../services/searchService");
const { redactCollegePage, redactCollegeTruth } = require("../lib/truthRedactor");

const router = express.Router();

router.get('/flush-cache', async (req, res) => {
    try {
        await dataStore.invalidateCache();
        res.json({ success: true, message: 'Global Cache Flushed.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/colleges/batch', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'ids array is required in request body' });
        }
        
        const results = await Promise.all(
            ids.map(id => dataStore.getCollegeById(id))
        );
        
        // Filter out nulls and return
        const validResults = results.filter(Boolean).map(c => redactCollegeTruth(c));
        res.json(validResults);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/flush-pages', async (req, res) => {
    try {
        const redis = await getRedisClient();
        if (!redis) return res.status(500).json({ error: 'Redis unvailable' });
        const keys = await redis.keys('college:page:*');
        if (keys.length > 0) await redis.del(...keys);
        res.json({ success: true, message: `Flushed ${keys.length} page caches.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- ELEVATED TRUTH ROUTES (Hardenings delegated to truth_hardening.js) ---

router.get("/college/:id/benchmarks", async (req, res) => {
  try {
    const { id } = req.params;
    let college = (global.colleges || []).find(c => c.id === id || c._id === id);
    if (!college) {
        const key = id.toLowerCase().replace(/[^a-z0-9]/g, '');
        college = (global.colleges || []).find(c => (c.id && c.id.toLowerCase().replace(/[^a-z0-9]/g, '') === key));
    }
    if (!college) return res.status(404).json({ error: "College intelligence not found" });
    const state = college.state;
    const band = college.competitivenessBand || college.rankingTier || "Standard";
    const stateColleges = (global.colleges || []).filter(c => c.state === state && c.ceiScore);
    const stateAvg = stateColleges.length > 0 ? stateColleges.reduce((acc, c) => acc + (c.ceiScore || 0), 0) / stateColleges.length : 60;
    const bandColleges = (global.colleges || []).filter(c => (c.competitivenessBand === band || c.rankingTier === band) && c.ceiScore);
    const bandAvg = bandColleges.length > 0 ? bandColleges.reduce((acc, c) => acc + (c.ceiScore || 0), 0) / bandColleges.length : 70;
    res.json({ success: true, metadata: { state: state || "National", band: band }, stateBenchmarks: { ceiScore: Math.round(stateAvg) }, tierBenchmarks: { ceiScore: Math.round(bandAvg) } });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Canonicalize location names to handle variations (e.g., Bengaluru vs Bangalore)
const normalizeLocation = (loc) => {
  if (!loc) return loc;
  const canonicalMap = {
    'bangalore': 'Bengaluru',
    'bengaluru': 'Bengaluru',
    'bombay': 'Mumbai',
    'mumbai': 'Mumbai',
    'calcutta': 'Kolkata',
    'kolkata': 'Kolkata',
    'madras': 'Chennai',
    'chennai': 'Chennai',
    'gurgaon': 'Gurugram',
    'gurugram': 'Gurugram'
  };
  const key = loc.toLowerCase().trim();
  return canonicalMap[key] || loc;
};

// Helper to construct MongoDB filter query
const buildCollegeQuery = (reqQuery) => {
  const { state, district, q, tier, course, exam, isPremium, isCore, all, coverage } = reqQuery;
  
  // Default to allowing all colleges (Phase 2 Wiring)
  const query = {};
  
  // --- CEI SURFACE TIER ENFORCEMENT ---
  const hiddenIds = surfaceTierRegistry.getHiddenIds();
  if (hiddenIds.length > 0) {
      query.$and = query.$and || [];
      query.$and.push({ 
          $or: [
              { id: { $nin: hiddenIds } },
              { institution_id: { $nin: hiddenIds } }
          ]
      });
  }

  if (reqQuery.certifiedOnly === 'true') {
      const certifiedIds = surfaceTierRegistry.getTierIds("CERTIFIED_PUBLIC");
      query.$and = query.$and || [];
      query.$and.push({
          $or: [
              { id: { $in: certifiedIds } },
              { institution_id: { $in: certifiedIds } }
          ]
      });
  }

  // Preserve 'all' check for future-proofing or specific overrides
  if (all !== 'true') {
      query.isVisible = { $ne: false };
  }

  const andConditions = [];

  // Coverage filter — filters by coverage.coverageBucket (None/Partial/Rich)
  if (coverage && coverage !== 'All') {
    query['coverage.coverageBucket'] = coverage;
  }

  // [CEI] Deterministic Navigation Support - Enforce Canonical Authority Only
  if (reqQuery.authority) {
    query.authority_canonical = reqQuery.authority;
  }

  if (reqQuery.hasCutoffs === 'true') {
    query.$or = query.$or || [];
    query.$or.push(
        { 'engineeringCutoffs.0': { $exists: true } },
        { 'coverage.cutoffCoverage': { $in: ['Partial', 'Rich'] } }
    );
  }

  if (reqQuery.identityConfidence) {
    query.identityConfidence = reqQuery.identityConfidence;
  }

  if (isPremium) {
    query.isPremium = isPremium === 'true';
  }


  if (isCore) {
    query.isCore = isCore === 'true';
  }

  if (state && state !== 'All') {
    query.state = state;
  }

  if (district && district !== 'All') {
    query['meta.district'] = normalizeLocation(district);
  }

  if (reqQuery.location && reqQuery.location !== 'All') {
    query.location = normalizeLocation(reqQuery.location);
  }

  if (tier && tier !== 'All') {
    query.rankingTier = tier;
  }

  if (reqQuery.band && reqQuery.band !== 'All') {
    query.competitivenessBand = reqQuery.band;
  }

  if (course && course !== 'All') {
    const normalizedCourse = course.toLowerCase().trim();
    const categoryMap = {
      'engineering': ['b.tech', 'b.e', 'm.tech', 'engineering', 'technology'],
      'management': ['mba', 'pgdm', 'mms', 'management', 'business'],
      'medical': ['mbbs', 'bds', 'medical', 'medicine', 'health'],
      'design': ['b.des', 'm.des', 'design'],
      'commerce': ['b.com', 'm.com', 'commerce', 'accountancy'],
      'arts': ['b.a', 'm.a', 'arts', 'social sciences', 'humanities'],
      'law': ['ll.b', 'llm', 'law', 'legal'],
      'pharmacy': ['b.pharm', 'm.pharm', 'pharmacy', 'pharma', 'all-pharmacy'],
      'science': ['b.sc', 'm.sc', 'science'],
      'architecture': ['b.arch', 'm.arch', 'architecture', 'planning']
    };

    const searchTerms = categoryMap[normalizedCourse] || [normalizedCourse];
    const regexPattern = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    andConditions.push({
      $or: [
        { 'courses.name': { $regex: regexPattern, $options: 'i' } },
        { 'courses.degree': { $regex: regexPattern, $options: 'i' } }
      ]
    });
  }

  if (exam) {
    query.acceptedExams = { $regex: exam, $options: 'i' };
  }

  if (q) {
    const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safeQ, 'i');

    // If query is just one character, be MUCH stricter to avoid noise like "DPU" matching "Y"
    if (q.length === 1) {
      andConditions.push({
        $or: [
          { shortName: { $regex: new RegExp(`^${safeQ}`, 'i') } },
          { name: { $regex: new RegExp(`\\b${safeQ}`, 'i') } } // Matches if a word starts with the letter
        ]
      });
    } else {
      // Add initials match for "ii" -> "IIT", "iiit" cases
      const initialRegex = new RegExp('^' + q.split('').join('.*'), 'i');

      andConditions.push({
        $or: [
          { id: { $regex: regex } },
          { institution_id: { $regex: regex } },
          { stableKey: { $regex: regex } },
          { name: { $regex: regex } },
          { shortName: { $regex: regex } },
          { institution_name: { $regex: regex } },
          { name: { $regex: initialRegex } } // Initials match
        ]
      });
    }
  }

  if (andConditions.length > 0) {
    query.$and = andConditions;
  }

  return query;
};

// Helper for sorting
const buildSortQuery = (reqQuery) => {
  const { sortBy, order } = reqQuery;
  const sortDirection = order === 'desc' ? -1 : 1;

  let sort = {};

  switch (sortBy) {
    case 'name':
      sort.name = sortDirection;
      break;
    case 'ranking':
    case 'tier':
      // Tier 1 > Tier 2 > Tier 3 > Stand Alone. String sort desc puts 'Tier 3' before 'Tier 1' unfortunately.
      // Easiest is to sort ascending to get 1, 2, 3. 
      // If user wants descending (best first), we actually want ascending string (Tier 1 is best).
      sort.rankingTier = sortDirection === -1 ? 1 : -1;
      // Add a secondary sort to make it deterministic
      sort.isPremium = -1;
      break;
    // Placement is tricky in Mongo since it's unstructured text ("20-30 LPA").
    // As a workaround, we'll sort by Premium first, then name.
    // Placement uses the newly calculated highestPackageNumeric to mathematically sort
    case 'placement':
      sort['placements.highestPackageNumeric'] = -1; // Descending packages (CPA/LPA normalized to LPA)
      sort.ceiScore = -1; // Fallback to intelligence score
      sort.name = 1;
      break;
    case 'popularity':
      sort.ceiScore = -1;
      sort.name = 1;
      break;
    case 'exams':
      // Can't directly sort by array length in standard find(). We'll fallback.
      sort.isPremium = -1;
      break;
    case 'ceiScore':
      sort.ceiScore = -1;
      sort.name = 1;
      break;
    default:
      // Default to highest CEI score first
      sort = { ceiScore: -1, name: 1 };
  }

  return sort;
};

router.get("/colleges", async (req, res) => {
  try {
    // --- Input Validation & Sanitization ---
    const rawQ = req.query.q;
    if (rawQ && rawQ.length > 100) {
      return res.status(400).json({ error: "Search query too long (max 100 characters)" });
    }

    // ── RANKING CACHE FAST PATH ────────────────────────────────────────────────
    // For pure ranking queries (no text search, no district filter),
    // attempt to serve from the precomputed Redis ranking cache.
    // Expected response time: 5-15ms (Redis) vs 120-160ms (MongoDB sort).
    let { page, limit, district, sortBy, state, tier, band } = req.query;
    let q = req.query.q;

    // [CEI] Query Expansion: Acronym -> Full Name for better Recall
    if (q) {
      const qLower = q.toLowerCase().trim();
      if (/\bnit\b/.test(qLower)) q = "National Institute of Technology";
      else if (/\biit\b/.test(qLower)) q = "Indian Institute of Technology";
      else if (/\biiit\b/.test(qLower)) q = "Indian Institute of Information Technology";
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const isRankingQuery = !req.query.cursor && !q && !district && (sortBy === 'ceiScore' || sortBy === 'placement' || sortBy === 'popularity' || sortBy === 'ranking');

    if (isRankingQuery && pageNum === 1) {
      // Resolve the canonical Redis key for this dimension
      const normSortBy = (sortBy === 'popularity' || sortBy === 'ranking') ? 'ceiScore' : sortBy;
      let rankKey = null;

      if (state && state !== 'All') {
        rankKey = rankingCache.rankingKey('state', rankingCache.normalise(state), normSortBy);
      } else if (tier && tier !== 'All') {
        rankKey = rankingCache.rankingKey('tier', rankingCache.normalise(tier), normSortBy);
      } else if (band && band !== 'All') {
        rankKey = rankingCache.rankingKey('band', rankingCache.normalise(band), normSortBy === 'ceiScore' ? 'placement' : normSortBy);
      } else {
        rankKey = `ranking:global:${normSortBy}`;
      }

      if (rankKey) {
        const cached = await rankingCache.getRanking(rankKey);

        if (cached !== null) {
          // Backwards compatibility check: If it's an array (old data), adapt it
          const isOldFormat = Array.isArray(cached);
          const cacheData = isOldFormat ? cached : cached.data;
          const totalCount = isOldFormat ? cacheData.length : cached.totalCount;

          // Slice for pagination within the precomputed top-200
          const pageSlice = cacheData.slice(0, limitNum);
          res.set('X-Cache', 'RANKING-HIT');
          res.set('X-Cache-Key', rankKey);
          return res.json({
            data: pageSlice,
            pagination: {
              page: 1,
              limit: limitNum,
              totalCount: totalCount,
              totalPages: Math.ceil(totalCount / limitNum),
              hasNext: totalCount > limitNum,
              hasPrev: false,
              source: 'ranking_cache',
            },
          });
        }

        // Cache MISS: fire async background rebuild so next request hits cache
        const mongoFilter = {};
        const baseFilter = {};
        const mongoSortField = normSortBy === 'ceiScore'
          ? 'ceiScore'
          : 'placements.highestPackageNumeric';
        if (state && state !== 'All') {
          mongoFilter.state = state;
          baseFilter.state = state;
        }
        if (tier && tier !== 'All') {
          mongoFilter.rankingTier = tier;
          baseFilter.rankingTier = tier;
        }
        if (band && band !== 'All') {
          mongoFilter.competitivenessBand = band;
          baseFilter.competitivenessBand = band;
        }
        if (normSortBy === 'ceiScore') mongoFilter.ceiScore = { $ne: null };
        else mongoFilter['placements.highestPackageNumeric'] = { $gt: 0 };

        rankingCache.buildOneAsync(mongoFilter, mongoSortField, rankKey, baseFilter);
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    const key = `mongo:colleges:${JSON.stringify(req.query)}`;

    const cached = await cache.get(key);
    if (cached) {
      return res.json(cached);
    }

    // Cursor processing for limitless pagination
    const rawCursor = req.query.cursor;

    const query = buildCollegeQuery({ ...req.query, q });
    const sort = buildSortQuery({ ...req.query, q });
    const sortKeys = Object.keys(sort);

    const primarySortField = sortKeys.find(k => k !== '_id' && k !== 'isPremium');
    const primarySortDir = primarySortField ? sort[primarySortField] : null;

    if (rawCursor && primarySortField) {
      try {
        const decoded = JSON.parse(Buffer.from(rawCursor, 'base64').toString('ascii'));
        const { v: cursorValue, id: cursorId } = decoded;

        const inequality = primarySortDir === -1 ? '$lt' : '$gt';

        query.$or = query.$or || [];
        query.$or.push(
          { [primarySortField]: { [inequality]: cursorValue } },
          {
            [primarySortField]: cursorValue,
            _id: { [primarySortDir === -1 ? '$lt' : '$gt']: cursorId }
          }
        );
      } catch (err) {
        console.warn('Invalid cursor provided, falling back to page 1');
      }
    }

    const skip = rawCursor ? 0 : (pageNum - 1) * limitNum;

    // Phase 1: Aggregation Pipeline to force projection BEFORE sorting
    const pipeline = [
      { $match: query }
    ];

    if (sortKeys.length > 0) {
      const sortProject = { _id: 1 };
      sortKeys.forEach(k => { sortProject[k] = 1; });
      
      // [CEI] Don't project-away identity fields if we need them for re-ranking!
      if (q) {
        sortProject.id = 1;
        sortProject.institution_id = 1;
        sortProject.name = 1;
        sortProject.shortName = 1;
        sortProject.institution_name = 1;
        sortProject.isCore = 1;
        sortProject.ceiScore = 1;
        sortProject.institutionStrengthScore = 1;
      }

      pipeline.push({ $project: sortProject });
      pipeline.push({ $sort: sort });
    }

    // [CEI] Pipeline orchestration: 
    // If search 'q' is present, we fetch a large candidate pool (200) to allow re-ranking Core institutions.
    // We skip/paginate in memory AFTER filtering and ranking.
    if (q) {
      console.log('[CEI][mongo] Final Pipeline:', JSON.stringify(pipeline, null, 2));
      pipeline.push({ $limit: 200 });
    } else {
      if (skip > 0) pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limitNum });
    }

    // --- Unified Truth Layer (Memory/Mongo Orchestration) ---
    const hasProductionFilters = req.query.coverage || req.query.authority || req.query.hasCutoffs;
    
    // If no production filters and not forcing Mongo, try the high-speed memory path
    if (!req.query.forceMongo && !hasProductionFilters) {
      const allColleges = await dataStore.getColleges();
      if (allColleges && allColleges.length > 0) {
        // [CEI] Final Query Diagnostic (Memory Path)
        console.log('[CEI][memory] Filtering 67k records...');



      const qLower = q ? q.toLowerCase() : null;

      const filtered = allColleges.filter(c => {
        // [CEI] Respect visibility: exclude hidden/shell nodes (isVisible: false)
        if (c.isVisible === false) return false;

        // [CEI] SURFACE TIER ENFORCEMENT
        if (c.surface_tier === "HIDE_UNTIL_HYDRATED") return false;
        if (req.query.certifiedOnly === 'true' && c.surface_tier !== "CERTIFIED_PUBLIC") return false;

        if (state && state !== 'All' && c.state !== state) return false;
        if (tier && tier !== 'All' && c.rankingTier !== tier) return false;
        if (band && band !== 'All' && c.competitivenessBand !== band) return false;
        if (qLower) {
          // [CEI] Search all name-bearing fields: name, shortName, institution_name
          // This ensures CORE institutions (which may only have institution_name) are found
          return (
            (c.name || "").toLowerCase().includes(qLower) ||
            (c.shortName || "").toLowerCase().includes(qLower) ||
            (c.institution_name || "").toLowerCase().includes(qLower) ||
            (c.id || "").toLowerCase().includes(qLower) ||
            (c.institution_id || "").toLowerCase().includes(qLower) ||
            (c.stableKey || "").toLowerCase().includes(qLower)
          );
        }
        return true;
      });

      // [CEI] If text search returned 0 results from memory, fall through to MongoDB.
      // This surfaces CORE institutions that exist in MongoDB but are not yet in the
      // in-memory cache (e.g. when server started without a MongoDB connection).
      if (qLower && filtered.length === 0) {
        // Fall through to MongoDB path below
        console.log(`[CEI][search] Memory miss for q="${q}", falling through to MongoDB.`);
      } else {
        // [CEI] Unified Intent & Ranking Pipeline
        const intentFiltered = q ? applyIntentFilter(filtered, q) : filtered;
        const totalCount = intentFiltered.length;
        const sorted = rankResults(intentFiltered, q);
        const colleges = sorted.slice(skip, skip + limitNum);

        return res.json({
          data: colleges.map(c => {
            const cid = String(c.id || c._id || "");
            return {
              id: cid,
              _id: cid,
              name: c.name,
              shortName: c.shortName,
              location: c.location,
              rankingTier: c.rankingTier,
              ceiScore: c.ceiScore,
              institutionStrengthScore: c.institutionStrengthScore,
              admissionRealityScore: c.admissionRealityScore,
              dataConfidenceScore: c.dataConfidenceScore,
              coverage: c.coverage,
              isPremium: c.isPremium,
              isCore: c.isCore,
              identity: c.identity,
              coreMetadata: c.coreMetadata,
              placements: c.placements,
              fees: c.fees,
              website: c.website,
              slug: `/college/${cid}`,
              // [CEI] Surface Tier Metadata (for badge & visibility enforcement)
              surface_tier: c.surface_tier,
              certified_badge_allowed: c.certified_badge_allowed,
              public_listing_visible: c.public_listing_visible,
              search_visible: c.search_visible,
              detail_accessible: c.detail_accessible,
              release_metrics_included: c.release_metrics_included
            };
          }),
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
            nextCursor: null,
            hasNext: skip + limitNum < totalCount,
            hasPrev: pageNum > 1
          }
        });
      }
    }
  }


    // ── PRODUCTION MONGODB PATH (Decision Routing) ────────────────
    try {
      [sortedIdsResult, totalCount] = await Promise.all([
        College.aggregate(pipeline),
        College.countDocuments(query)
      ]);
    } catch (mongoErr) {
      return res.status(500).json({ error: "Database failure", message: mongoErr.message });
    }


    // ── RUNTIME GUARD: Zero Dead Ends ────────────────────────────────────────
    if (totalCount === 0 && !req.query.q) {
      // If precision routing fails, try a high-trust regional or authority fallback
      const fallbackQuery = { isVisible: { $ne: false }, identityConfidence: 'HIGH' };
      
      // Attempt to retain at least the coverage quality or the authority
      if (query['coverage.coverageBucket']) fallbackQuery['coverage.coverageBucket'] = query['coverage.coverageBucket'];
      else if (query.authority) fallbackQuery.authority = query.authority;

      const fallbackDocs = await College.find(fallbackQuery).limit(limitNum).lean();
      if (fallbackDocs.length > 0) {
        // [CEI] Fallback Visibility Logging
        try {
            const logDir = path.join(__dirname, '../logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            const logEntry = JSON.stringify({
                timestamp: new Date().toISOString(),
                type: "ZERO_RESULT_FALLBACK",
                original_query: query,
                fallback_query: fallbackQuery,
                reason: "ZERO_RESULT"
            }) + "\n";
            fs.appendFileSync(path.join(logDir, 'fallback_events.ndjson'), logEntry);
        } catch (e) {
            console.error("Failed to log fallback event:", e);
        }

        return res.json({
          data: fallbackDocs.map(c => normalizeCollege(c)),
          pagination: { 
            total: fallbackDocs.length, 
            page: 1, 
            limit: limitNum,
            isFallback: true 
          },
          meta: { 
            status: "ZERO_RESULT_FALLBACK",
            originalQuery: query 
          }
        });
      }
    }



    const ids = sortedIdsResult.map(c => c._id);
    const fetchedColleges = await College.find({ _id: { $in: ids } }).lean();

    const collegeMap = new Map();
    fetchedColleges.forEach(rawC => {
      const c = normalizeCollege(rawC);
      const cid = c.id;
      if (cid) collegeMap.set(cid, c);
      // Map by _id too to ensure the sortedIdsResult mapping below can find it!
      collegeMap.set(String(rawC._id), c);
    });

    const collegesRaw = ids.map(id => {
      const sId = id ? String(id) : "";
      return sId ? collegeMap.get(sId) : null;
    }).filter(Boolean);
    
    // [CEI] Re-apply Intent Filtering and Deterministic Ranking to MongoDB results
    const intentFiltered = q ? applyIntentFilter(collegesRaw, q) : collegesRaw;
    const ranked = rankResults(intentFiltered, q);
    
    // [CEI] Correct totalCount for search intents
    const currentTotalCount = q ? intentFiltered.length : totalCount;
    
    // Re-apply pagination after re-ranking (since we fetched 100+ candidates)
    const colleges = q ? ranked.slice(skip, skip + limitNum) : ranked;


    let debugCursor = {};
    let nextCursor = null;
    if (colleges.length === limitNum && primarySortField) {
      // The items in 'colleges' are already in the exact sorted order dictated by the aggregation
      const lastItem = colleges[colleges.length - 1];

      let lastValue = lastItem;
      const parts = primarySortField.split('.');
      for (const part of parts) {
        if (lastValue) lastValue = lastValue[part];
      }
      debugCursor = { sortField: primarySortField, extractedValue: lastValue, id: lastItem._id };

      if (lastValue !== undefined && lastValue !== null) {
        const cursorObj = { v: lastValue, id: lastItem._id.toString() };
        nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');
      }
    }

    const totalPages = Math.ceil(currentTotalCount / limitNum);


    const result = {
      data: colleges.map(c => {
        const cid = c.id || (c._id ? c._id.toString() : null);
        const skey = c.stableKey;
        let website = c.website;

        // Phase 22: Merge verified website link
        if (global.websites) {
          if (skey && global.websites.has(skey)) {
            website = global.websites.get(skey);
          } else if (cid && global.websites.has(cid)) {
            website = global.websites.get(cid);
          } else if (c.name) {
            const key = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (global.websiteByName.has(key)) {
                website = global.websiteByName.get(key);
            }
          }
        }

        return {
          ...c,
          id: cid,
          website: website
        };
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount: currentTotalCount,
        totalPages,
        nextCursor,
        _debug: debugCursor,
        hasNext: !!nextCursor || (q && skip + limitNum < currentTotalCount),
        hasPrev: pageNum > 1,
      },
    };

    cache.set(key, result, 300); // 5 min cache
    res.json(result);
  } catch (error) {
    console.error("Error in MongoDB /colleges route:", error);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
});


router.get("/college/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Invalid college ID provided" });
    }

    // [CEI] Deterministic Identity Resolution (MCC medical IDs -> CORE IDs)
    let resolvedId = identityResolver.resolveCanonicalId(id) || id;
    let initialResolvedId = resolvedId;

    // ── EARLY TIER GUARD — must run before any page assembly or cache call ─────
    // F3 fix: HIDE_UNTIL_HYDRATED institutions must return 403 immediately.
    // Do not call pageCache.getCollegePage / dataStore for hidden tiers.
    const _earlyTierMeta = surfaceTierRegistry.getTierMetadata(resolvedId);
    if (_earlyTierMeta && _earlyTierMeta.surface_tier === 'HIDE_UNTIL_HYDRATED') {
        return res.status(403).json({
            error: 'College hydrated surface not public',
            id,
            canonicalId: resolvedId,
            surface_tier: _earlyTierMeta.surface_tier,
            message: 'This institution is not yet available for public access.'
        });
    }

    // ── COLLEGE PAGE AGGREGATION CACHE ────────────────────────────────────────
    let page = await pageCache.getCollegePage(resolvedId);
    let parentFound = 'none';
    
    const hasPage = !!page;
    const hasCollege = !!(page && page.college);
    const hasParentId = !!(page && page.college && page.college.parent_core_id);
    const startsWithMCC = String(resolvedId).startsWith('MCC-');

    if (hasPage && hasCollege && hasParentId && startsWithMCC) {
        parentFound = page.college.parent_core_id;
        resolvedId = page.college.parent_core_id;
        page = await pageCache.getCollegePage(resolvedId);
    }

    const isResolved = resolvedId !== id;

    if (page) {
      const college = page.college;
      if (college && college.surface_tier === "HIDE_UNTIL_HYDRATED" && !req.query.debug) {
          return res.status(403).json({ error: "College hydrated surface not public" });
      }

      if (isResolved) {
          page.resolution = {
              requested_id: id,
              resolved_id: resolvedId,
              resolution_method: "deterministic_mapping"
          };
      }
      res.set('X-Cache', 'PAGE-HIT');
      const safePage = redactCollegePage(page);
      return res.json(safePage);
    }

    // Hard fallback: pageCache.getCollegePage already handles Mongo misses,
    // but if it returns null the college genuinely doesn't exist.
    return res.status(404).json({ error: "College not found" });
  } catch (error) {
    console.error("Error fetching college from MongoDB:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Batch get colleges by IDs
router.get("/colleges/batch", async (req, res) => {
  let ids = [];
  if (req.query.ids) {
    if (Array.isArray(req.query.ids)) {
      ids = req.query.ids;
    } else {
      ids = req.query.ids.split(',');
    }
  }

  if (ids.length === 0) {
    return res.json([]);
  }

  if (ids.length > 50) {
    return res.status(400).json({ error: "Maximum 50 colleges per batch request" });
  }

  try {
    console.log(`[Batch Fetch] Hydrating top-level metrics for IDs: ${ids.join(', ')}`);

    // Fetch deeply hydrated profiles for the Battle Arena using the exact same pipeline as the Dashboard
    const fetchedColleges = await Promise.all(
        ids.map(async (id) => {
            try {
                const college = await pageCache.getCollegePage(id);
                // pageCache.getCollegePage returns null if not found
                return college || null;
            } catch (err) {
                console.error(`Error hydrating ${id} for batch:`, err);
                return null;
            }
        })
    );

    // Filter out nulls and preserve exact ordering
    const orderedColleges = fetchedColleges.filter(Boolean);
    const safeColleges = orderedColleges.map(page => redactCollegePage(page));

    res.json(safeColleges);
  } catch (error) {
    console.error("Error in MongoDB batch fetch:", error);
    res.status(500).json({ error: "Failed to fetch colleges batch" });
  }
});

// High-speed endpoint exclusively for Next.js Sitemap Generation
router.get("/sitemap-batch", async (req, res) => {
  const { page = 0, limit = 10000 } = req.query;
  const skip = parseInt(page) * parseInt(limit);

  try {
    const key = `mongo:sitemap:${page}:${limit}`;
    const cached = await cache.get(key);
    if (cached) return res.json(cached);

    // Only select the bare minimum data needed for sitemaps
    const colleges = await College.find({})
      .select('id updatedAt')
      .sort({ _id: 1 }) // Deterministic sort
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Only cache in Redis if it's NOT development to save quota
    if (process.env.NODE_ENV !== 'development' || process.env.VERCEL) {
        await cache.set(key, colleges, 86400); // 24 hour cache
    }
    res.json(colleges);
  } catch (error) {
    console.error("Error in sitemap-batch:", error);
    res.status(500).json({ error: "Failed to fetch sitemap batch" });
  }
});

// Dynamic Filters
router.get("/filters", async (req, res) => {
  try {
    const key = `mongo:filters:${JSON.stringify(req.query)}`;
    const cached = await cache.get(key);
    if (cached) return res.json(cached);

    const matchQuery = buildCollegeQuery(req.query);
    let states = [], metaDistricts = [], topDistricts = [];
    
    try {
      [states, metaDistricts, topDistricts] = await Promise.all([
        College.distinct("state", matchQuery),
        College.distinct("meta.district", matchQuery),
        College.distinct("district", matchQuery)
      ]);
    } catch (dbErr) {
      console.warn("MongoDB dynamic filters failed to execute distinct query, falling back to defaults:", dbErr.message);
    }

    const commonCourses = ["Engineering", "Management", "Medical", "Design", "Commerce", "Arts", "Law", "Pharmacy", "Science", "Architecture"];

    const result = {
      states: states.filter(Boolean).sort(),
      districts: [...new Set([...metaDistricts, ...topDistricts])].filter(Boolean).sort(),
      tiers: ["Tier 1", "Tier 2", "Tier 3", "University", "Stand Alone"],
      courses: commonCourses,
      bands: ['Elite', 'High', 'Competitive', 'Moderate', 'Emerging']
    };

    await cache.set(key, result, 300);
    res.json(result);
  } catch (error) {
    console.error("Error in MongoDB dynamic /filters route:", error);
    // Don't 500 unless absolutely fatal. At worst return defaults.
    res.status(200).json({
      states: [],
      districts: [],
      tiers: ["Tier 1", "Tier 2", "Tier 3", "University", "Stand Alone"],
      courses: ["Engineering", "Management", "Medical", "Design", "Commerce", "Arts", "Law", "Pharmacy", "Science", "Architecture"],
      bands: ['Elite', 'High', 'Competitive', 'Moderate', 'Emerging']
    });
  }
});


// Get state-wise college counts (with optional filtering)
router.get("/states/stats", async (req, res) => {
  try {
    const key = `mongo:states:stats:${JSON.stringify(req.query)}`;
    const cached = await cache.get(key);
    if (cached) return res.json(cached);

    const matchQuery = buildCollegeQuery(req.query);

    const aggregation = await College.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$state",
          count: { $sum: 1 },
          topColleges: { $push: { $ifNull: ["$shortName", "$name"] } }
        }
      },
      {
        $project: {
          name: "$_id",
          count: 1,
          topColleges: { $slice: ["$topColleges", 3] } // Keep only top 3 names for the map tooltip
        }
      },
      { $sort: { count: -1 } }
    ]);

    const result = aggregation.map(s => {
      const isUT = ["Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
        "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"].includes(s.name);

      return {
        ...s,
        type: isUT ? "UT" : "State"
      };
    }).filter(s => s.name);

    const response = {
      totalStates: result.filter(s => s.type === "State").length,
      totalUTs: result.filter(s => s.type === "UT").length,
      totalColleges: result.reduce((sum, s) => sum + s.count, 0),
      states: result
    };

    await cache.set(key, response, 300); // 5 min cache
    res.json(response);
  } catch (error) {
    console.error("Error in MongoDB /states/stats route:", error);
    res.status(500).json({ error: "Failed to compile state statistics" });
  }
});

// ── Phase 2: Truth Adapter Routes ──────────────────────────────────────────
// Adapts VerifiedField data into the shape expected by TruthSeatsSection.jsx

router.get("/colleges/:id/truth/seats", async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Fetch college with hydrated truth
    const collegeDoc = await dataStore.getCollegeById(id);
    
    // 2. Check if hydrated seats exist (Phase 30 integration)
    const seatsData = collegeDoc.seats || collegeDoc.seatMatrix;
    if (collegeDoc && seatsData && seatsData.length > 0) {
      const validItems = seatsData.filter(s => s.programName && (s.acpcIntake || s.totalIntake || s.intake));
      
      if (validItems.length > 0) {
        return res.json({
          sectionStatus: 'available',
          freshnessStatus: 'up_to_date',
          primarySource: validItems[0].sourceAuthority || 'Official Authority',
          lastEvaluatedAt: validItems[0].extractedAt,
          items: validItems.map(s => ({
            displayLabel: `Intake: ${s.programName}`,
            degree: s.courseFamily,
            specialization: s.programName,
            value: s.acpcIntake || s.totalIntake || s.intake,
            source: {
              title: s.sourceDocumentType || 'Seat Matrix 2025',
              type: 'primary_authority',
              url: s.sourceUrl,
              lastEvaluatedAt: s.extractedAt
            }
          }))
        });
      }
    }

    // 3. Fallback to VerifiedField (Legacy System)
    const field = await VerifiedField.findOne({ collegeId: id, fieldName: 'student_intake' }).lean();

    if (!field) {
      return res.json({ sectionStatus: 'official_data_unavailable', items: [] });
    }

    const sources = await SourceEvidence.find({
      verifiedFieldId: { $in: field.sourceIds },
      isActive: true
    }).lean();

    const primarySource = sources[0] || {};

    res.json({
      sectionStatus: 'available',
      freshnessStatus: 'up_to_date',
      primarySource: primarySource.sourceType === 'official_authority' ? 'Authority Portal' : 'Official Report',
      lastEvaluatedAt: field.lastVerifiedAt,
      items: [{
        displayLabel: 'Total Approved Intake',
        degree: 'B.E./B.Tech',
        specialization: 'General',
        value: field.fieldValue,
        source: {
          title: primarySource.sourceURL ? 'ACPC Gujarat 2025' : 'Verified Submission',
          type: 'primary_authority',
          url: primarySource.sourceURL,
          lastEvaluatedAt: primarySource.capturedAt
        }
      }]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/colleges/:id/truth/cutoffs", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch college with hydrated truth
    const collegeDoc = await dataStore.getCollegeById(id);
    const engNames = seatCutoffBridge.getEngineeringNamesForId(id);
    
    // 2. Query Truth Collection (Fallback enrichment for summary)
    const results = await getEngineeringCutoffs({
      db: mongoose.connection.db,
      filters: { 
        institutionId: id,
        $or: [
          { institution_id: id },
          { canonical_id: id },
          { institute_name_normalized: { $in: engNames } }
        ]
      },
      limit: 100
    });

    const cutoffData = (collegeDoc && collegeDoc.engineeringCutoffs && collegeDoc.engineeringCutoffs.length > 0) 
      ? collegeDoc.engineeringCutoffs 
      : results.items;

    // 3. Check if hydrated cutoffs exist
    if (cutoffData && cutoffData.length > 0) {
      const validItems = cutoffData.filter(c => (c.programName || c.programTitle) && (c.closingRank || c.closing_rank));

      if (validItems.length > 0) {
        return res.json({
          sectionStatus: 'available',
          freshnessStatus: 'up_to_date',
          primarySource: validItems[0].sourceAuthority || validItems[0].authority || 'Admission Authority',
          lastEvaluatedAt: validItems[0].extractedAt || validItems[0].extracted_at,
          items: validItems.map(c => ({
            displayLabel: `${c.programName || c.programTitle} (${c.category || c.category_canonical})`,
            degree: c.courseFamily || c.degreeAward,
            value: c.closingRank || c.closing_rank,
            metricType: 'Closing Rank',
            source: {
              title: c.sourceDocumentType || c.sourceLabel || 'Cutoff Report 2025',
              type: 'primary_authority',
              url: c.sourceUrl || c.source_url,
              lastEvaluatedAt: c.extractedAt || c.extracted_at
            }
          }))
        });
      }
    }

    const field = await VerifiedField.findOne({ collegeId: id, fieldName: 'closingRank' }).lean();

    if (!field) {
      return res.json({ sectionStatus: 'official_data_unavailable', items: [] });
    }

    const sources = await SourceEvidence.find({
      verifiedFieldId: { $in: field.sourceIds },
      isActive: true
    }).lean();

    const primarySource = sources[0] || {};

    res.json({
      sectionStatus: 'available',
      freshnessStatus: 'up_to_date',
      primarySource: 'Admission Committee',
      lastEvaluatedAt: field.lastVerifiedAt,
      items: [{
        displayLabel: 'General Category Closing Rank',
        degree: 'B.E./B.Tech',
        value: field.fieldValue,
        source: {
          title: 'Gujarat ACPC 2025 Cutoffs',
          type: 'primary_authority',
          url: primarySource.sourceURL,
          lastEvaluatedAt: primarySource.capturedAt
        }
      }]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/colleges/:id/truth/courses", async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 200 } = req.query;
    const db = mongoose.connection.db;
    
    // 1. Resolve college with matching ID (robust lookup)
    const college = await dataStore.getCollegeById(id);
    
    if (!college) {
      return res.status(404).json({ error: 'College not found' });
    }

    // 2. Call Bridge Service
    const result = await getCollegeTruthCourses({
      db,
      college,
      limit
    });

    res.json(result);
  } catch (error) {
    console.error("Error in truth/courses route:", error);
    res.status(500).json({ error: error.message });
  }
});


router.get("/colleges/:id/truth/fees", async (req, res) => {
  try {
    const { id } = req.params;

    // [CEI] Priority: Direct MongoDB read bypasses stale in-memory cache
    const College = require('../models/CollegeSchema');
    const mongoDoc = await College.findOne({ institution_id: id }).lean();
    const collegeDoc = mongoDoc || await dataStore.getCollegeById(id);
    if (collegeDoc && collegeDoc.fees && (collegeDoc.fees.isVerified || collegeDoc.fees.provenance || collegeDoc.fees.totalFee)) {
      const prov = collegeDoc.fees.provenance || {};
      const extractedAt = collegeDoc.fees.extracted_at || (prov.freshness ? new Date(prov.freshness) : new Date());
      const staleAfter = collegeDoc.fees.stale_after_days || 365;
      const isStale = (new Date() - new Date(extractedAt)) > (staleAfter * 24 * 60 * 60 * 1000);

      return res.json({
        sectionStatus: 'available',
        freshnessStatus: isStale ? 'stale' : 'up_to_date',
        isStale,
        primarySource: prov.sourceDocumentType || 'Official Fee Structure',
        sourceAuthority: collegeDoc.fees.source_authority || 'primary_authority',
        lastEvaluatedAt: extractedAt.toISOString(),
        items: [{
          displayLabel: 'Annual Fee (Total)',
          degree: 'All Programs',
          value: collegeDoc.fees.totalFee ? ('₹' + collegeDoc.fees.totalFee.toLocaleString()) : (collegeDoc.fees.total || (collegeDoc.fees.totalNumeric ? ('₹' + collegeDoc.fees.totalNumeric.toLocaleString()) : 'Official Data Unavailable')),
          source: {
            title: prov.sourceName || collegeDoc.fees.source || 'Verified Elite Source',
            type: 'primary_authority'
          }
        }]
      });
    }

    const field = await VerifiedField.findOne({ collegeId: id, fieldName: 'tuition_fees' }).lean();

    if (!field) {
      return res.json({ 
        sectionStatus: 'official_data_unavailable', 
        items: [],
        message: 'Direct fee verification pending for this institution.'
      });
    }

    const rawId = collegeDoc ? collegeDoc.stableKey : id;
    const sources = await SourceEvidence.find({
      verifiedFieldId: { $in: field.sourceIds },
      isActive: true
    }).lean();

    const primarySource = sources[0] || {};

    res.json({
      sectionStatus: 'available',
      freshnessStatus: 'up_to_date',
      primarySource: 'Fee Regulatory Committee',
      lastEvaluatedAt: field.lastVerifiedAt,
      items: [{
        displayLabel: 'Annual Tuition Fee',
        degree: 'B.E./B.Tech',
        value: field.fieldValue,
        source: {
          title: 'Gujarat FRC 2025-26',
          type: 'primary_authority',
          url: primarySource.sourceURL,
          lastEvaluatedAt: primarySource.capturedAt
        }
      }]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/colleges/:id/truth/placements", async (req, res) => {
  try {
    const { id } = req.params;
    const pkgField = await VerifiedField.findOne({ collegeId: id, fieldName: 'avg_package' }).lean();
    const rateField = await VerifiedField.findOne({ collegeId: id, fieldName: 'placement_rate' }).lean();

    // --- NDJSON Truth Data Integration (Phase 21) ---
    // [CEI] Priority: Direct MongoDB read bypasses stale in-memory cache
    const College = require('../models/CollegeSchema');
    const mongoPlacementDoc = await College.findOne({ institution_id: id }).lean();
    const collegeDoc = mongoPlacementDoc || await dataStore.getCollegeById(id);
    
    const aliases = new Set(identityResolver.getAllAliases(id));
    if (collegeDoc && collegeDoc.stableKey) aliases.add(collegeDoc.stableKey);
    if (collegeDoc && collegeDoc.id) aliases.add(collegeDoc.id);

    let truthEntries = (global.truthRows || []).filter(tr => 
      (aliases.has(tr.collegeId) || aliases.has(tr.id) || aliases.has(tr.stableKey)) && 
      tr.entityType === 'placement'
    );

    const hasIngestedPlacements = collegeDoc && collegeDoc.placements && (collegeDoc.placements.source === 'NIRF 2024' || collegeDoc.placements.provenance || collegeDoc.placements.averagePackage);

    if (!pkgField && !rateField && truthEntries.length === 0 && !hasIngestedPlacements) {
      return res.json({ 
        sectionStatus: 'official_data_unavailable', 
        items: [],
        message: 'Placement audit in progress for 2025 cycle.'
      });
    }

    const items = [];
    let lastEvaluatedAt = collegeDoc?.sourceMetadata?.promotedAt || collegeDoc?.placements?.provenance?.freshness || null;
    let sectionStale = false;
    let sectionAuthority = 'official_source';

    if (collegeDoc?.placements?.extracted_at) {
      const p = collegeDoc.placements;
      const staleAfter = p.stale_after_days || 365;
      sectionStale = (new Date() - new Date(p.extracted_at)) > (staleAfter * 24 * 60 * 60 * 1000);
      sectionAuthority = p.source_authority || 'official_source';
      lastEvaluatedAt = new Date(p.extracted_at).toISOString();
    }

    // 1. Ingested NIRF 2024 Truth (Phase 22 - Bridge)
    if (hasIngestedPlacements) {
      const p = collegeDoc.placements;
      const prov = p.provenance || {};
      
      if (p.averagePackage || p.averagePackageNumeric) {
        items.push({
          displayLabel: prov.sourceDocumentType?.includes('NIRF') || p.source === 'NIRF 2024' ? 'Median Salary (NIRF)' : 'Average Package',
          value: p.averagePackage || `₹${(p.averagePackageNumeric / 100000).toFixed(2)} LPA`,
          confidence: 0.98,
          metricType: 'Median Salary',
          applicableBatchYear: p.academicYear || prov.academicYear,
          source: { title: prov.sourceName || p.source || 'NIRF 2024', type: 'official_source' }
        });
      }
      
      if (p.highestPackage) {
        items.push({
          displayLabel: 'Highest Package',
          value: p.highestPackage,
          confidence: 0.98,
          metricType: 'Highest Package',
          applicableBatchYear: p.academicYear || prov.academicYear,
          source: { title: prov.sourceName || p.source || 'Official Source', type: 'official_source' }
        });
      }
      
      if (p.placedPercentage) {
        items.push({
          displayLabel: 'Placement Rate',
          value: `${p.placedPercentage}%`,
          confidence: 0.98,
          source: { title: prov.sourceName || p.source || 'Official Source', type: 'official_source' }
        });
      }
    }

    // Add NDJSON Truth items first (Higher Priority)
    truthEntries.forEach(tr => {
      if (tr.medianSalary) {
        items.push({
          displayLabel: 'Median Salary (Truth)',
          value: `₹${(tr.medianSalary/100000).toFixed(2)} LPA`,
          confidence: 0.98,
          source: { title: tr.source || 'Official Report', type: 'official_source', url: tr.evidenceUrl }
        });
      }
      if (tr.placedPercentage) {
        items.push({
          displayLabel: 'Placement rate (Truth)',
          value: `${tr.placedPercentage}%`,
          confidence: 0.95,
          source: { title: tr.source || 'Official Report', type: 'official_source' }
        });
      }
      if (tr.highestPackage) {
        const val = typeof tr.highestPackage === 'number' ? (tr.highestPackage > 100 ? `₹${(tr.highestPackage/100).toFixed(2)} Cr` : `₹${tr.highestPackage} LPA`) : tr.highestPackage;
        items.push({
          displayLabel: 'Highest Package',
          value: val,
          metricType: 'Highest Package',
          confidence: 0.99,
          source: { title: tr.source || 'Institutional Disclosure', type: 'official_source' }
        });
      }
    });

    if (pkgField) {
      items.push({
        displayLabel: 'Average CTC',
        value: `₹${pkgField.fieldValue} LPA`,
        confidence: pkgField.confidenceScore,
        source: { title: 'Placement Report 2024', type: 'official_institute' }
      });
      lastEvaluatedAt = pkgField.lastVerifiedAt;
    }

    if (rateField) {
      items.push({
        displayLabel: 'Placement Rate',
        value: `${rateField.fieldValue}%`,
        confidence: rateField.confidenceScore,
        source: { title: 'NIRF Data 2024', type: 'primary_authority' }
      });
      if (!lastVerifiedAt || new Date(rateField.lastVerifiedAt) > new Date(lastVerifiedAt)) {
        lastVerifiedAt = rateField.lastVerifiedAt;
      }
    }

    res.json({
      sectionStatus: 'available',
      freshnessStatus: sectionStale ? 'stale' : 'verified_audit',
      isStale: sectionStale,
      sourceAuthority: sectionAuthority,
      lastEvaluatedAt,
      items
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Removed (moved to top)

module.exports = router;
