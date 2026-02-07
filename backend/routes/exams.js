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
  const cached = cache.get(key);
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
    const rawList = exam.collegesAccepting || exam.acceptedColleges || [];
    const resolved = rawList
      .map((item) => collegeIdToName.get(item) || item)
      .filter(Boolean);

    let acceptedCount = resolved.length;
    let acceptedCollegesResolved = resolved;

    if (acceptedCount === 0) {
      const examKey = (exam.id || exam.shortName || exam.name || "").toLowerCase();
      const matches = colleges.filter((college) =>
        (college.acceptedExams || []).some(
          (e) => e.toLowerCase() === examKey
        )
      );
      acceptedCollegesResolved = matches.map(
        (college) => college.shortName || college.name
      );
      acceptedCount = acceptedCollegesResolved.length;
    }

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

  const rawList = exam.collegesAccepting || exam.acceptedColleges || [];
  const resolved = rawList
    .map((item) => collegeIdToName.get(item) || item)
    .filter(Boolean);

  let acceptedCount = resolved.length;
  let acceptedCollegesResolved = resolved;

  if (acceptedCount === 0) {
    const examKey = (exam.id || exam.shortName || exam.name || "").toLowerCase();
    const matches = colleges.filter((college) =>
      (college.acceptedExams || []).some(
        (e) => e.toLowerCase() === examKey
      )
    );
    acceptedCollegesResolved = matches.map(
      (college) => college.shortName || college.name
    );
    acceptedCount = acceptedCollegesResolved.length;
  }

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
