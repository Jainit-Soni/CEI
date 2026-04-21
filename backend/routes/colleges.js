const express = require("express");
const mongoose = require("mongoose");
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

const router = express.Router();

router.get('/flush-cache', async (req, res) => {
    try {
        await dataStore.invalidateCache();
        res.json({ success: true, message: 'Global Cache Flushed.' });
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
  
  // Preserve 'all' check for future-proofing or specific overrides
  if (all === 'true') {
      // already empty, no-op
  }

  const andConditions = [];

  // Coverage filter — filters by coverage.coverageBucket (None/Partial/Rich)
  if (coverage && coverage !== 'All') {
    query['coverage.coverageBucket'] = coverage;
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
          { _id: { $regex: safeQ, $options: 'i' } },
          { id: { $regex: safeQ, $options: 'i' } },
          { name: { $regex: safeQ, $options: 'i' } },
          { shortName: { $regex: safeQ, $options: 'i' } },
          { name: { $regex: '^' + q.split('').join('.*'), $options: 'i' } } // Initials match
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
    const { page, limit, q, district, sortBy, state, tier, band } = req.query;
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

    const query = buildCollegeQuery(req.query);
    const sort = buildSortQuery(req.query);
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
      pipeline.push({ $project: sortProject });
      pipeline.push({ $sort: sort });
    }

    if (skip > 0) pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNum });

    // --- Unified Truth Layer (Memory-First Path) ---
    const allColleges = await dataStore.getColleges();
    if (allColleges && allColleges.length > 0 && !req.query.forceMongo) {
      const filtered = allColleges.filter(c => {
        if (state && state !== 'All' && c.state !== state) return false;
        if (tier && tier !== 'All' && c.rankingTier !== tier) return false;
        if (band && band !== 'All' && c.competitivenessBand !== band) return false;
        if (q) {
          const qLower = q.toLowerCase();
          return (c.name || "").toLowerCase().includes(qLower) || (c.shortName || "").toLowerCase().includes(qLower);
        }
        return true;
      });

      const totalCount = filtered.length;
      const sorted = filtered.sort((a, b) => (b.ceiScore || 0) - (a.ceiScore || 0) || String(a.id).localeCompare(String(b.id)));
      const colleges = sorted.slice(skip, skip + limitNum);

      return res.json({
        data: colleges.map(c => {
          const cid = String(c.id || c._id || "");
          const cleanName = c.shortName || c.name || "Unknown";
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
            coreMetadata: c.coreMetadata,
            placements: c.placements,
            fees: c.fees,
            website: c.website,
            slug: `/college/${cid}`
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

    // ── LEGACY MONGODB PATH (Only if memory-first is skipped) ────────────────
    let sortedIdsResult, totalCount;
    try {
      [sortedIdsResult, totalCount] = await Promise.all([
        College.aggregate(pipeline),
        College.countDocuments(query)
      ]);
    } catch (mongoErr) {
      return res.status(500).json({ error: "Database failure", message: mongoErr.message });
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

    const colleges = ids.map(id => {
      const sId = id ? String(id) : "";
      return sId ? collegeMap.get(sId) : null;
    }).filter(Boolean);


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

    const totalPages = Math.ceil(totalCount / limitNum);


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
        totalCount,
        totalPages,
        nextCursor,
        _debug: debugCursor,
        hasNext: !!nextCursor,
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

    // ── COLLEGE PAGE AGGREGATION CACHE ────────────────────────────────────────
    // Returns precomputed payload: college + anomalies + integrity + verifications.
    // Cache hit: 5-15ms | Cache miss: assembles from Mongo, writes through.
    const page = await pageCache.getCollegePage(id);
    if (page) {
      res.set('X-Cache', 'PAGE-HIT');
      return res.json(page);
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

    res.json(orderedColleges);
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
    const [states, metaDistricts, topDistricts] = await Promise.all([
      College.distinct("state", matchQuery),
      College.distinct("meta.district", matchQuery),
      College.distinct("district", matchQuery)
    ]);

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
    res.status(500).json({ error: "Failed to load dynamic filters" });
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
    const college = await College.findOne({
      $or: [
        { id: String(id) },
        { _id: mongoose.isValidObjectId(id) ? id : null },
        { stableKey: String(id) }
      ]
    }).select('id institution_id courses').lean();
    
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

    // Phase 1.5 - Bridge Elite Fee Source of Truth Layer
    const collegeDoc = await dataStore.getCollegeById(id);
    if (collegeDoc && collegeDoc.fees && collegeDoc.fees.isVerified) {
      return res.json({
        sectionStatus: 'available',
        freshnessStatus: 'up_to_date',
        primarySource: 'Official Fee Structure',
        lastEvaluatedAt: collegeDoc.fees.promotedAt || new Date().toISOString(),
        items: [{
          displayLabel: 'Annual Fee (Total)',
          degree: 'All Programs',
          value: collegeDoc.fees.total || ('₹' + collegeDoc.fees.totalNumeric.toLocaleString()),
          source: {
            title: collegeDoc.fees.source || 'Verified Elite Source',
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
    // Fetch a fresh copy using unified system to maintain ID mappings
    const collegeDoc = await dataStore.getCollegeById(id);
    
    const aliases = new Set(identityResolver.getAllAliases(id));
    if (collegeDoc && collegeDoc.stableKey) aliases.add(collegeDoc.stableKey);
    if (collegeDoc && collegeDoc.id) aliases.add(collegeDoc.id);

    let truthEntries = (global.truthRows || []).filter(tr => 
      (aliases.has(tr.collegeId) || aliases.has(tr.id) || aliases.has(tr.stableKey)) && 
      tr.entityType === 'placement'
    );

    const hasIngestedPlacements = collegeDoc && collegeDoc.placements && collegeDoc.placements.source === 'NIRF 2024';

    if (!pkgField && !rateField && truthEntries.length === 0 && !hasIngestedPlacements) {
      return res.json({ 
        sectionStatus: 'official_data_unavailable', 
        items: [],
        message: 'Placement audit in progress for 2025 cycle.'
      });
    }

    const items = [];
    let lastEvaluatedAt = collegeDoc?.sourceMetadata?.promotedAt || null;

    // 1. Ingested NIRF 2024 Truth (Phase 22 - Bridge)
    if (hasIngestedPlacements) {
      const p = collegeDoc.placements;
      items.push({
        displayLabel: 'Median Salary (NIRF)',
        value: `₹${(p.averagePackageNumeric / 100000).toFixed(2)} LPA`,
        confidence: 0.98,
        metricType: 'Median Salary',
        applicableBatchYear: p.academicYear,
        source: { title: 'NIRF 2024', type: 'official_source' }
      });
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
      freshnessStatus: 'verified_audit',
      lastEvaluatedAt,
      items
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Removed (moved to top)

module.exports = router;
