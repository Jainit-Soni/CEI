const express = require("express");
const { getColleges, getExams } = require("../services/dataStore");
const { buildFuse } = require("../services/search");

const router = express.Router();

router.get("/search", async (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  if (!q) return res.json({ colleges: [], exams: [] });

  const { getCollegeFuse, getExamFuse } = require("../services/search");

  const collegeFuse = await getCollegeFuse();
  const examFuse = await getExamFuse();

  const collegeResults = collegeFuse.search(q).map((r) => r.item);
  const examResults = examFuse.search(q).map((r) => r.item);

  res.json({ colleges: collegeResults, exams: examResults });
});

router.get("/suggest", async (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  const typeParam = req.query.type; // college or exam
  if (!q) return res.json([]);

  const colleges = await getColleges();
  const exams = await getExams();

  let collegeSuggestions = [];
  if (!typeParam || typeParam === "college") {
    collegeSuggestions = colleges
      .filter((c) => {
        const name = (c.name || "").toLowerCase();
        const short = (c.shortName || "").toLowerCase();
        // Match name, shortName, or check if query is initials of the name
        return name.includes(q) || short.includes(q) ||
          name.split(/\s+/).map(w => w[0]).join("").includes(q);
      })
      .slice(0, 8)
      .map(c => ({
        id: c.id,
        name: c.name,
        location: c.location,
        type: "college"
      }));
  }

  let examSuggestions = [];
  if (!typeParam || typeParam === "exam") {
    examSuggestions = exams
      .filter((e) => {
        const name = (e.name || "").toLowerCase();
        const short = (e.shortName || "").toLowerCase();
        return name.includes(q) || short.includes(q);
      })
      .slice(0, 8)
      .map(e => ({
        id: e.id,
        name: e.shortName || e.name,
        fullName: e.name,
        type: "exam"
      }));
  }

  res.json([...collegeSuggestions, ...examSuggestions]);
});

module.exports = router;
