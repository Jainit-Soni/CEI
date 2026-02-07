const express = require("express");
const { getColleges } = require("../services/dataStore");
const cache = require("../services/cache");

const router = express.Router();

// Helper function to normalize state names for comparison
function normalizeStateName(name) {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/&/g, "and")  // Replace & with "and"
    .replace(/\s+/g, " ")   // Normalize whitespace
    .trim();
}

router.get("/colleges", async (req, res) => {
  try {
    const key = `colleges:${JSON.stringify(req.query)}`;
    const cached = cache.get(key);
    if (cached) return res.json(cached);

    let colleges = await getColleges();

    // Check if colleges loaded successfully
    if (!Array.isArray(colleges)) {
      console.error("Failed to load colleges - not an array");
      return res.status(500).json({ error: "Failed to load college data" });
    }
    const { state, district, q, sortBy, order, page, limit } = req.query;

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

router.get("/college/:id", (req, res) => {
  const { getCollegeById } = require("../services/dataStore");
  const college = getCollegeById(req.params.id);
  if (!college) return res.status(404).json({ error: "College not found" });
  res.json(college);
});

// Get state-wise college counts
router.get("/states/stats", (req, res) => {
  const key = "states:stats";
  const cached = cache.get(key);
  if (cached) return res.json(cached);

  const colleges = getColleges();
  const stateStats = {};

  // Initialize all states/UTs with 0
  const allStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
    "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
  ];

  // Create normalized state map for lookup
  const normalizedStateMap = {};
  allStates.forEach(state => {
    const normalized = normalizeStateName(state);
    normalizedStateMap[normalized] = state;
    stateStats[state] = { count: 0 };
  });

  // Add mappings for old separate names to merged UT
  // Dadra and Nagar Haveli -> Dadra and Nagar Haveli and Daman and Diu
  normalizedStateMap["dadra and nagar haveli"] = "Dadra and Nagar Haveli and Daman and Diu";
  // Daman and Diu -> Dadra and Nagar Haveli and Daman and Diu
  normalizedStateMap["daman and diu"] = "Dadra and Nagar Haveli and Daman and Diu";

  // Initialize with empty objects instead of arrays
  Object.keys(stateStats).forEach(state => {
    stateStats[state] = { count: 0 };
  });

  // Count colleges by state
  colleges.forEach(college => {
    let stateName = null;

    if (college.location) {
      const parts = college.location.split(',').map(p => p.trim());
      const lastPart = parts[parts.length - 1];
      const normalizedLastPart = normalizeStateName(lastPart);

      // Check normalized match
      if (normalizedStateMap[normalizedLastPart]) {
        stateName = normalizedStateMap[normalizedLastPart];
      }
    }

    if (stateName && stateStats[stateName]) {
      stateStats[stateName].count++;
    }
  });

  // Convert to array format for easier consumption
  const result = Object.entries(stateStats).map(([name, data]) => ({
    name,
    count: data.count,
    type: ["Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
      "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"].includes(name) ? "UT" : "State"
  })).sort((a, b) => b.count - a.count);

  const response = {
    totalStates: result.filter(s => s.type === "State").length,
    totalUTs: result.filter(s => s.type === "UT").length,
    totalColleges: colleges.length,
    states: result
  };

  cache.set(key, response);
  res.json(response);
});

// Get filter options (unique values for dropdowns)
router.get("/filters", (req, res) => {
  const key = "filters:all";
  const cached = cache.get(key);
  if (cached) return res.json(cached);

  const colleges = getColleges();

  // Extract unique values
  const states = new Set();
  const districts = new Set();
  const tiers = new Set();
  const courses = new Set();

  colleges.forEach(college => {
    // State
    if (college.location) {
      const parts = college.location.split(',').map(p => p.trim());
      const state = parts[parts.length - 1];
      if (state) states.add(state);
    }

    // District
    const district = college.meta?.district || college.district;
    if (district) districts.add(district);

    // Tier
    const tier = college.rankingTier || college.ranking;
    if (tier) tiers.add(tier);

    // Courses
    if (college.courses) {
      college.courses.forEach(course => {
        if (course.name) courses.add(course.name);
      });
    }
  });

  const result = {
    states: Array.from(states).sort(),
    districts: Array.from(districts).sort(),
    tiers: Array.from(tiers).sort(),
    courses: Array.from(courses).sort()
  };

  cache.set(key, result, 600); // Cache for 10 minutes
  res.json(result);
});

// Batch get colleges by IDs
router.get("/colleges/batch", (req, res) => {
  const { getCollegeById } = require("../services/dataStore");
  const ids = req.query.ids ? req.query.ids.split(',') : [];

  if (ids.length === 0) {
    return res.json([]);
  }

  if (ids.length > 50) {
    return res.status(400).json({ error: "Maximum 50 colleges per batch request" });
  }

  const colleges = ids.map(id => getCollegeById(id)).filter(Boolean);
  res.json(colleges);
});

module.exports = router;
