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
  if (!typeParam || typeParam === "college" || typeParam === "all") {
    collegeSuggestions = colleges
      .map(c => {
        const name = (c.name || "").toLowerCase();
        const short = (c.shortName || "").toLowerCase();
        let score = 0;

        if (short === q) score += 100;
        else if (short.startsWith(q)) score += 50;
        else if (name.startsWith(q)) score += 30;
        else if (name.includes(q) || short.includes(q)) score += 10;

        const initials = name.split(/\s+/).map(w => w[0]).join("");
        if (initials.includes(q)) score += 40; // High priority for "ii" -> "IIT" etc

        return { ...c, _score: score };
      })
      .filter(c => c._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 8)
      .map(c => ({
        id: c.id,
        name: c.name,
        location: c.location,
        type: "college"
      }));
  }

  let examSuggestions = [];
  if (!typeParam || typeParam === "exam" || typeParam === "all") {
    examSuggestions = exams
      .map(e => {
        const name = (e.name || "").toLowerCase();
        const short = (e.shortName || "").toLowerCase();
        let score = 0;

        if (short === q) score += 100;
        else if (short.startsWith(q)) score += 50;
        else if (name.startsWith(q)) score += 30;
        else if (name.includes(q) || short.includes(q)) score += 10;

        return { ...e, _score: score };
      })
      .filter(e => e._score > 0)
      .sort((a, b) => b._score - a._score)
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
