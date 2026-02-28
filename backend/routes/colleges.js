const express = require("express");
const College = require("../models/CollegeSchema");
const cache = require("../services/cache");

const router = express.Router();

// Helper to construct MongoDB filter query
const buildCollegeQuery = (reqQuery) => {
  const { state, district, q, tier, course, exam, isPremium } = reqQuery;
  const query = {};
  const andConditions = [];

  if (isPremium) {
    query.isPremium = isPremium === 'true';
  }

  if (state && state !== 'All') {
    query.state = state;
  }

  if (district && district !== 'All') {
    query['meta.district'] = district;
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
          { name: { $regex: regex } },
          { shortName: { $regex: regex } },
          { name: { $regex: initialRegex } } // Allows "ii" to match "Indian Institute..."
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
      sort.ceiScore = -1; // Premium/verified highest
      sort.name = 1;
      break;
    case 'exams':
      // Can't directly sort by array length in standard find(). We'll fallback.
      sort.isPremium = -1;
      break;
    default:
      // Default to premium first
      sort = { isPremium: -1, name: 1 };
  }

  return sort;
};

router.get("/colleges", async (req, res) => {
  try {
    const key = `mongo:colleges:${JSON.stringify(req.query)}`;

    const cached = await cache.get(key);
    if (cached) {
      return res.json(cached);
    }

    const { page, limit, q } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const query = buildCollegeQuery(req.query);
    const sort = buildSortQuery(req.query);

    const [colleges, totalCount] = await Promise.all([
      College.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      College.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    const result = {
      data: colleges,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages,
        hasNext: pageNum < totalPages,
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
    const key = `mongo:college:${req.params.id}`;
    const cached = await cache.get(key);
    if (cached) return res.json(cached);

    const college = await College.findOne({ id: req.params.id }).lean();
    if (!college) return res.status(404).json({ error: "College not found" });

    cache.set(key, college, 3600); // 1 hour cache For individual colleges
    res.json(college);
  } catch (error) {
    console.error("Error fetching college from MongoDB:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Batch get colleges by IDs
router.get("/colleges/batch", async (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : [];

  if (ids.length === 0) {
    return res.json([]);
  }

  if (ids.length > 50) {
    return res.status(400).json({ error: "Maximum 50 colleges per batch request" });
  }

  try {
    const colleges = await College.find({ id: { $in: ids } }).lean();

    // Preserve order of incoming IDs
    const collegeMap = new Map(colleges.map(c => [c.id, c]));
    const orderedColleges = ids.map(id => collegeMap.get(id)).filter(Boolean);

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

    await cache.set(key, colleges, 86400); // 24 hour cache
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

module.exports = router;
