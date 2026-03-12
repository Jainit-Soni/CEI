const express = require("express");
const { getExams } = require("../services/dataStore");
const { search, suggest, getProviderInfo } = require("../services/searchService");
const cache = require("../services/cache");

const router = express.Router();

/**
 * GET /api/search?q=...&state=...&tier=...
 *
 * Unified search — auto-routes to Meilisearch (5ms, typo-tolerant)
 * or MongoDB $text index (30ms) depending on environment config.
 */
router.get("/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q || q.length > 100) return res.json({ colleges: [], exams: [] });

  const filters = {};
  if (req.query.state) filters.state = req.query.state;
  if (req.query.tier) filters.tier = req.query.tier;
  if (req.query.band) filters.band = req.query.band;

  const cacheKey = `search:unified:${q.toLowerCase()}:${JSON.stringify(filters)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const [colleges, exams] = await Promise.all([
      search(q, { limit: 20, filters }),
      getExams(),
    ]);

    // Exam search — small dataset, in-memory is fine
    const qLower = q.toLowerCase();
    const examResults = exams
      .filter(e => {
        const name = (e.name || "").toLowerCase();
        const short = (e.shortName || "").toLowerCase();
        return name.includes(qLower) || short.includes(qLower) || short.startsWith(qLower);
      })
      .slice(0, 8);

    const result = { colleges, exams: examResults };
    await cache.set(cacheKey, result, 300); // 5 min
    res.json(result);
  } catch (err) {
    console.warn("[search] Fallback triggered:", err.message);
    // Return empty results instead of crashing the front-end
    res.json({ colleges: [], exams: [] });
  }
});

/**
 * GET /api/suggest?q=...&type=college|exam|all
 *
 * Lightweight typeahead — returns compact id/name/location objects.
 */
router.get("/suggest", async (req, res) => {
  const q = (req.query.q || "").trim();
  const typeParam = req.query.type;
  if (!q || q.length > 100) return res.json([]);

  const cacheKey = `suggest:v2:${typeParam || 'all'}:${q.toLowerCase()}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    let collegeSuggestions = [];
    if (!typeParam || typeParam === "college" || typeParam === "all") {
      collegeSuggestions = await suggest(q);
    }

    let examSuggestions = [];
    if (!typeParam || typeParam === "exam" || typeParam === "all") {
      const exams = await getExams();
      const qLower = q.toLowerCase();
      examSuggestions = exams
        .filter(e => {
          const name = (e.name || "").toLowerCase();
          const short = (e.shortName || "").toLowerCase();
          return short === qLower || short.startsWith(qLower) || name.startsWith(qLower) || name.includes(qLower);
        })
        .slice(0, 5)
        .map(e => ({ id: e.id, name: e.shortName || e.name, fullName: e.name, type: "exam" }));
    }

    const result = [...collegeSuggestions, ...examSuggestions];
    await cache.set(cacheKey, result, 600); // 10 min
    res.json(result);
  } catch (err) {
    console.warn("[suggest] Fallback triggered:", err.message);
    res.json([]); // Return empty list to prevent UI breakage
  }
});

/**
 * GET /api/search/provider — diagnostic endpoint
 *
 * Returns which search backend is active (meilisearch | mongodb) and its metrics.
 */
router.get("/search/provider", (req, res) => {
  res.json(getProviderInfo());
});

module.exports = router;
