const express = require("express");
const { getExams, getColleges } = require("../services/dataStore");
const cache = require("../services/cache");

const router = express.Router();

const syllabusById = {
  "xat": [
    "Verbal & Logical Ability",
    "Decision Making",
    "Quantitative Ability & Data Interpretation",
    "General Knowledge"
  ],
  "cmat": [
    "Quantitative Techniques & Data Interpretation",
    "Logical Reasoning",
    "Language Comprehension",
    "General Awareness",
    "Innovation & Entrepreneurship"
  ],
  "snap": [
    "General English",
    "Analytical & Logical Reasoning",
    "Quantitative, Data Interpretation & Data Sufficiency"
  ],
  "gate": [
    "General Aptitude",
    "Subject-specific paper"
  ]
};

router.get("/exams", async (req, res) => {
  const key = `exams_v2:${JSON.stringify(req.query)}`;
  const cached = await cache.get(key);
  if (cached) return res.json(cached);

  let exams = await getExams();
  const colleges = await getColleges();

  const { type, q } = req.query;

  if (type) {
    exams = exams.filter((e) => e.type.toLowerCase() === type.toLowerCase());
  }
  if (q) {
    const query = q.toLowerCase().trim();
    exams = exams.filter((e) => e.name.toLowerCase().includes(query));
  }

  const normalizeForMatch = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const normalizedExams = exams.map((exam) => {
    const examKeys = [exam.id, exam.shortName, exam.name].filter(Boolean);
    const normalizedExamKeys = examKeys.map(normalizeForMatch);

    const matchingColleges = colleges.filter((college) => {
      const fromJsonList = (exam.collegesAccepting || exam.acceptedColleges || []);
      if (fromJsonList.includes(college.id)) return true;

      return (college.acceptedExams || []).some((e) => {
        const normalizedE = normalizeForMatch(e);
        return normalizedExamKeys.some(key => normalizedE.includes(key) || key.includes(normalizedE));
      });
    });

    const acceptedCollegesResolved = matchingColleges.map(c => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName
    }));

    const acceptedCount = acceptedCollegesResolved.length;

    const syllabus = exam.syllabus && exam.syllabus.length > 0
      ? exam.syllabus
      : syllabusById[exam.id];

    return {
      ...exam,
      syllabus,
      acceptedCount,
      acceptedCollegesResolved,
    };
  });

  cache.set(key, normalizedExams);
  res.json(normalizedExams);
});

router.get("/exam/:id", async (req, res) => {
  const exams = await getExams();
  const colleges = await getColleges();
  const collegeIdToName = new Map(
    colleges.map((c) => [c.id, c.shortName || c.name])
  );

  const exam = exams.find((e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  const normalizeForMatch = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const examKeys = [exam.id, exam.shortName, exam.name].filter(Boolean);
  const normalizedExamKeys = examKeys.map(normalizeForMatch);

  const matchingColleges = colleges.filter((college) => {
    const fromJsonList = (exam.collegesAccepting || exam.acceptedColleges || []);
    if (fromJsonList.includes(college.id)) return true;

    return (college.acceptedExams || []).some((e) => {
      const normalizedE = normalizeForMatch(e);
      return normalizedExamKeys.some(key => normalizedE.includes(key) || key.includes(normalizedE));
    });
  });

  const acceptedCollegesResolved = matchingColleges.map(c => ({
    id: c.id,
    name: c.name,
    shortName: c.shortName
  }));

  const acceptedCount = acceptedCollegesResolved.length;

  const syllabus = exam.syllabus && exam.syllabus.length > 0
    ? exam.syllabus
    : syllabusById[exam.id];

  res.json({
    ...exam,
    syllabus,
    acceptedCount,
    acceptedCollegesResolved,
  });
});

module.exports = router;
