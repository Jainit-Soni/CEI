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
  if (!q) return res.json([]);

  const colleges = await getColleges();
  const exams = await getExams();

  const suggestions = [
    ...colleges.map((c) => c.name),
    ...exams.map((e) => e.name),
  ]
    .filter((name) => name.toLowerCase().includes(q))
    .slice(0, 8);

  res.json(suggestions);
});

module.exports = router;
