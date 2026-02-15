const express = require("express");
const { getColleges } = require("../services/dataStore");
const cache = require("../services/cache");

const router = express.Router();

// Helper function to normalize state names for comparison
function normalizeStateName(name) {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/-/g, " ")    // Replace dashes with spaces
    .replace(/&/g, "and")  // Replace & with "and"
    .replace(/\s+/g, " ")   // Normalize whitespace
    .trim();
}

function getState(college) {
  if (!college?.location) return null;
  const parts = college.location.split(",").map((p) => p.trim());
  return parts[parts.length - 1];
}

router.get("/colleges", async (req, res) => {
  try {
    const key = `colleges:${JSON.stringify(req.query)}`;

    /* 
      SCALE MODE: Stale-While-Revalidate Pattern 
      - Try to get fresh data
      - If fails or slow, use stale data if available? 
      - Actually, for this project, a simple aggressive TTL (5 min) is enough.
      - We rely on Redis being fast.
    */
    const cached = await cache.get(key);
    if (cached) {
      // Background revalidation could go here if needed
      return res.json(cached);
    }

    let colleges = await getColleges();

    // Check if colleges loaded successfully
    if (!Array.isArray(colleges)) {
      console.error("Failed to load colleges - not an array");
      return res.status(500).json({ error: "Failed to load college data" });
    }
    const { state, district, q, tier, course, sortBy, order, page, limit } = req.query;

    // Filtering
    if (state) {
      const normalizedState = normalizeStateName(state);
      colleges = colleges.filter((c) => {
        const collegeState = c.state || getState(c);
        return normalizeStateName(collegeState) === normalizedState;
      });
    }
    if (district) {
      const normalized = district.toLowerCase();
      colleges = colleges.filter((c) => {
        const value = (c.meta?.district || c.district || "").toLowerCase();
        return value === normalized;
      });
    }
    if (tier && tier !== 'All') {
      colleges = colleges.filter((c) => (c.rankingTier || c.ranking) === tier);
    }
    if (course && course !== 'All') {
      const normalizedCourse = course.toLowerCase().trim();
      // Broad category mapping
      const categoryMap = {
        'engineering': ['b.tech', 'b.e', 'm.tech', 'engineering', 'technology'],
        'management': ['mba', 'pgdm', 'mms', 'management', 'business'],
        'medical': ['mbbs', 'bds', 'medical', 'medicine', 'pharma', 'health'],
        'design': ['b.des', 'm.des', 'design'],
        'commerce': ['b.com', 'm.com', 'commerce', 'accountancy'],
        'arts': ['b.a', 'm.a', 'arts', 'social sciences', 'humanities']
      };

      const searchTerms = categoryMap[normalizedCourse] || [normalizedCourse];

      colleges = colleges.filter((c) => (c.courses || []).some(courseObj => {
        const courseName = (courseObj?.name || "").toLowerCase();
        const courseDegree = (courseObj?.degree || "").toLowerCase();
        return searchTerms.some(term => courseName.includes(term) || courseDegree.includes(term));
      }));
    }
    if (req.query.exam) {
      const examQuery = req.query.exam.toLowerCase().trim();
      colleges = colleges.filter((c) =>
        (c.acceptedExams || []).some(e => e.toLowerCase().includes(examQuery))
      );
    }
    if (q) {
      const query = q.toLowerCase().trim();
      colleges = colleges.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(query);
        const shortNameMatch = c.shortName && c.shortName.toLowerCase().includes(query);
        const aliasMatch = c.alias && c.alias.some(a => a.toLowerCase().includes(query));
        return nameMatch || shortNameMatch || aliasMatch;
      });
    }

    // Sorting
    if (sortBy) {
      const sortOrder = order === "desc" ? -1 : 1;
      colleges = [...colleges].sort((a, b) => {
        let aVal, bVal;
        switch (sortBy) {
          case "name":
            aVal = a.name || "";
            bVal = b.name || "";
            return sortOrder * aVal.localeCompare(bVal);
          case "ranking":
          case "tier":
            const tierScore = (t) => {
              const tier = (t || "").toString().toLowerCase();
              if (tier.includes("tier 1")) return 3;
              if (tier.includes("tier 2")) return 2;
              if (tier.includes("tier 3")) return 1;
              return 0;
            };
            aVal = tierScore(a.rankingTier || a.ranking);
            bVal = tierScore(b.rankingTier || b.ranking);
            return sortOrder * (bVal - aVal);
          case "popularity":
            // Custom Weighting: Tier (High impact) + Exam Count (Secondary)
            const getPopScore = (c) => {
              let score = 0;
              const tier = (c.rankingTier || c.ranking || "").toString().toLowerCase();
              if (tier.includes("tier 1")) score += 1000;
              else if (tier.includes("tier 2")) score += 500;
              else if (tier.includes("tier 3")) score += 100;

              // Bonus for verified/official source
              if (c.source === "Official Website" || c.source?.includes("Admin")) score += 50;

              // Bonus for accepting many exams (indicates accessibility)
              score += (c.acceptedExams || []).length * 5;

              return score;
            };
            return sortOrder * (getPopScore(b) - getPopScore(a));
          case "exams":
            aVal = (a.acceptedExams || []).length;
            bVal = (b.acceptedExams || []).length;
            return sortOrder * (bVal - aVal);
          default:
            return 0;
        }
      });
    }

    // Total count before pagination
    const totalCount = colleges.length;

    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedColleges = colleges.slice(startIndex, endIndex);
    const totalPages = Math.ceil(totalCount / limitNum);

    const result = {
      data: paginatedColleges,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    };

    cache.set(key, result);
    res.json(result);
  } catch (error) {
    console.error("Error in /colleges route:", error);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
});

router.get("/college/:id", async (req, res) => {
  const { getCollegeById } = require("../services/dataStore");
  try {
    const college = await getCollegeById(req.params.id);
    if (!college) return res.status(404).json({ error: "College not found" });
    res.json(college);
  } catch (error) {
    console.error("Error fetching college:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get state-wise college counts (with optional filtering)
router.get("/states/stats", async (req, res) => {
  const { q, district, tier, course, exam } = req.query;
  const { getGlobalStats } = require("../services/dataStore");

  // FAST PATH: If no filters, return pre-computed stats
  if (!q && !district && !tier && (!course || course === 'All') && !exam) {
    const globalStats = getGlobalStats();
    if (globalStats) return res.json(globalStats);
  }

  // ... (FALLBACK TO SLOW CALCULATION IF FILTERS EXIST) ...
  // Create a unique cache key based on filters
  const key = `states:stats:${JSON.stringify(req.query)}`;
  const cached = await cache.get(key);
  if (cached) return res.json(cached);

  let colleges = await getColleges(); // This is cached in dataStore

  // --- Apply Filters (Same logic as /colleges main route) ---
  if (q) {
    const query = q.toLowerCase().trim();
    colleges = colleges.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(query);
      const shortNameMatch = c.shortName && c.shortName.toLowerCase().includes(query);
      return nameMatch || shortNameMatch;
    });
  }
  if (district && district !== 'All') {
    const normalized = district.toLowerCase();
    colleges = colleges.filter((c) => (c.meta?.district || c.district || "").toLowerCase() === normalized);
  }
  if (tier && tier !== 'All') {
    colleges = colleges.filter((c) => (c.rankingTier || c.ranking) === tier);
  }
  if (course && course !== 'All') {
    colleges = colleges.filter((c) => (c.courses || []).some(courseObj => courseObj?.name === course));
  }
  // ---------------------------------------------------------

  const stateStats = {};

  const allStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
    "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
  ];

  const normalizedStateMap = {};
  allStates.forEach(state => {
    const normalized = normalizeStateName(state);
    normalizedStateMap[normalized] = state;
    stateStats[state] = { count: 0, colleges: [] };
  });

  normalizedStateMap["dadra and nagar haveli"] = "Dadra and Nagar Haveli and Daman and Diu";
  normalizedStateMap["daman and diu"] = "Dadra and Nagar Haveli and Daman and Diu";

  colleges.forEach(college => {
    let stateName = null;
    if (college.location) {
      const parts = college.location.split(',').map(p => p.trim());
      const lastPart = parts[parts.length - 1];
      const normalizedLastPart = normalizeStateName(lastPart);
      if (normalizedStateMap[normalizedLastPart]) {
        stateName = normalizedStateMap[normalizedLastPart];
      }
    }

    if (stateName && stateStats[stateName]) {
      stateStats[stateName].count++;
      if (stateStats[stateName].colleges.length < 3) {
        stateStats[stateName].colleges.push(college.shortName || college.name);
      }
    }
  });

  const result = Object.entries(stateStats).map(([name, data]) => ({
    name,
    count: data.count,
    topColleges: data.colleges,
    type: ["Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
      "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"].includes(name) ? "UT" : "State"
  })).sort((a, b) => b.count - a.count);

  const response = {
    totalStates: result.filter(s => s.type === "State").length,
    totalUTs: result.filter(s => s.type === "UT").length,
    totalColleges: colleges.length,
    states: result
  };

  await cache.set(key, response, 300); // 5 min cache
  res.json(response);
});

// Get filter options (unique values for dropdowns)
router.get("/filters", async (req, res) => {
  try {
    const { state, district, q, tier, course } = req.query;
    const { getGlobalFilters } = require("../services/dataStore");

    // FAST PATH: If no active filters (initial load), return global pre-computed filters
    if (!state && !district && !q && !tier && !course) {
      const globalFilters = getGlobalFilters();
      if (globalFilters) return res.json(globalFilters);
    }

    // ... (FALLBACK TO DYNAMIC CALCULATION) ...
    // We don't use full caching for dynamic filters, or we use a more granular key
    const key = `filters:dynamic:${JSON.stringify(req.query)}`;
    const cached = await cache.get(key);
    if (cached) return res.json(cached);

    let colleges = await getColleges();

    // 1. Apply active filters to get the "working set" for drop-downs
    if (state) {
      const normalizedState = normalizeStateName(state);
      colleges = colleges.filter((c) => normalizeStateName(c.state || getState(c)) === normalizedState);
    }
    if (district) {
      const normalized = district.toLowerCase();
      colleges = colleges.filter((c) => (c.meta?.district || c.district || "").toLowerCase() === normalized);
    }
    if (tier && tier !== 'All') {
      colleges = colleges.filter((c) => (c.rankingTier || c.ranking) === tier);
    }
    if (course && course !== 'All') {
      const normalizedCourse = course.toLowerCase().trim();
      const categoryMap = {
        'engineering': ['b.tech', 'b.e', 'm.tech', 'engineering', 'technology'],
        'management': ['mba', 'pgdm', 'mms', 'management', 'business'],
        'medical': ['mbbs', 'bds', 'medical', 'medicine', 'pharma', 'health'],
        'design': ['b.des', 'm.des', 'design'],
        'commerce': ['b.com', 'm.com', 'commerce', 'accountancy'],
        'arts': ['b.a', 'm.a', 'arts', 'social sciences', 'humanities']
      };
      const searchTerms = categoryMap[normalizedCourse] || [normalizedCourse];
      colleges = colleges.filter((c) => (c.courses || []).some(courseObj => {
        const courseName = (courseObj?.name || "").toLowerCase();
        const courseDegree = (courseObj?.degree || "").toLowerCase();
        return searchTerms.some(term => courseName.includes(term) || courseDegree.includes(term));
      }));
    }
    if (q) {
      const query = q.toLowerCase().trim();
      colleges = colleges.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(query);
        const shortNameMatch = c.shortName && c.shortName.toLowerCase().includes(query);
        return nameMatch || shortNameMatch;
      });
    }

    // 2. Extract unique values from the filtered set
    const statesSet = new Set();
    const districtsSet = new Set();
    const tiersSet = new Set();
    const coursesSet = new Set();

    for (const college of colleges) {
      // State
      const stateName = college.state || getState(college);
      if (stateName) statesSet.add(stateName);

      // District
      const dist = college.meta?.district || college.district;
      if (dist) districtsSet.add(dist);

      // Tier
      const tr = college.rankingTier || college.ranking;
      if (tr) tiersSet.add(tr);

      // Courses (flattening names)
      if (Array.isArray(college.courses)) {
        for (const cNameObject of college.courses) {
          if (cNameObject?.name) coursesSet.add(cNameObject.name);
        }
      }
    }

    const result = {
      states: Array.from(statesSet).filter(Boolean).sort(),
      districts: Array.from(districtsSet).filter(Boolean).sort(),
      tiers: Array.from(tiersSet).filter(Boolean).sort(),
      courses: Array.from(coursesSet).filter(Boolean).sort()
    };

    // Cache dynamic filters for a shorter time (5 mins)
    await cache.set(key, result, 300);
    res.json(result);
  } catch (error) {
    console.error("Error in dynamic /filters route:", error);
    res.status(500).json({ error: "Failed to load dynamic filters" });
  }
});

// Batch get colleges by IDs
router.get("/colleges/batch", async (req, res) => {
  const { getCollegeById } = require("../services/dataStore");
  const ids = req.query.ids ? req.query.ids.split(',') : [];

  if (ids.length === 0) {
    return res.json([]);
  }

  if (ids.length > 50) {
    return res.status(400).json({ error: "Maximum 50 colleges per batch request" });
  }

  try {
    const promises = ids.map(id => getCollegeById(id));
    const colleges = await Promise.all(promises);
    const validColleges = colleges.filter(Boolean);
    res.json(validColleges);
  } catch (error) {
    console.error("Error in batch fetch:", error);
    res.status(500).json({ error: "Failed to fetch colleges batch" });
  }
});

module.exports = router;
