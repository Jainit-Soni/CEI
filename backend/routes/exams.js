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
  const key = `exams:${JSON.stringify(req.query)}`;
  const cached = await cache.get(key);
  if (cached) return res.json(cached);

  let exams = await getExams();
  const colleges = await getColleges();
  const collegeIdToName = new Map(
    colleges.map((c) => [c.id, c.shortName || c.name])
  );

  const { type, q } = req.query;

  if (type) {
    exams = exams.filter((e) => e.type.toLowerCase() === type.toLowerCase());
  }
  if (q) {
    const query = q.toLowerCase().trim();
    exams = exams.filter((e) => e.name.toLowerCase().includes(query));
  }

  const normalizedExams = exams.map((exam) => {
    // Source 1: JSON collegesAccepting (static subset)
    const rawList = exam.collegesAccepting || exam.acceptedColleges || [];
    const fromJson = rawList
      .map((item) => collegeIdToName.get(item) || item)
      .filter(Boolean);

    // Source 2: Live DB — colleges whose acceptedExams includes this exam
    const examKeys = [
      exam.id, exam.shortName, exam.name
    ].filter(Boolean).map(k => k.toLowerCase().trim());

    const fromDb = colleges.filter((college) =>
      (college.acceptedExams || []).some(
        (e) => examKeys.includes(e.toLowerCase().trim())
      )
    ).map((college) => college.shortName || college.name);

    // Merge & deduplicate
    const merged = [...new Set([...fromJson, ...fromDb])];

    const syllabus = exam.syllabus && exam.syllabus.length > 0
      ? exam.syllabus
      : syllabusById[exam.id];

    return {
      ...exam,
      syllabus,
      acceptedCount: merged.length,
      acceptedCollegesResolved: merged,
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

  // Source 1: JSON collegesAccepting
  const rawList = exam.collegesAccepting || exam.acceptedColleges || [];
  const fromJson = rawList
    .map((item) => collegeIdToName.get(item) || item)
    .filter(Boolean);

  // Source 2: Live DB
  const examKeys = [
    exam.id, exam.shortName, exam.name
  ].filter(Boolean).map(k => k.toLowerCase().trim());

  const fromDb = colleges.filter((college) =>
    (college.acceptedExams || []).some(
      (e) => examKeys.includes(e.toLowerCase().trim())
    )
  ).map((college) => college.shortName || college.name);

  // Merge & deduplicate
  const merged = [...new Set([...fromJson, ...fromDb])];
  const acceptedCount = merged.length;
  const acceptedCollegesResolved = merged;

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
