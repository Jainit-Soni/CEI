const express = require("express");
const cache = require("../services/cache");
const Exam = require("../models/ExamSchema");
const College = require("../models/CollegeSchema");

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
  try {
    const key = `mongo:exams:${JSON.stringify(req.query)}`;
    const cached = await cache.get(key);
    if (cached) return res.json(cached);

    const { type, q } = req.query;

    let query = {};
    let projection = {};
    let sort = { name: 1 };

    if (type) {
      query.type = { $regex: new RegExp(`^${type}$`, "i") };
    }

    if (q) {
      query.$text = { $search: q };
      projection = { score: { $meta: "textScore" } };
      sort = { score: { $meta: "textScore" } };
    }

    const exams = await Exam.find(query, projection).sort(sort).lean();

    // Map through exams and find accepted colleges
    const normalizedExams = await Promise.all(exams.map(async (exam) => {
      // Fast college lookup if exam.id exists in College's acceptedExams array
      const examKeys = [exam.id, exam.shortName, exam.name].filter(Boolean);
      const regexPattern = examKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

      let collegeQuery = {};
      if (exam.collegesAccepting && exam.collegesAccepting.length > 0) {
        collegeQuery = {
          $or: [
            { id: { $in: exam.collegesAccepting } },
            { acceptedExams: { $regex: regexPattern, $options: 'i' } }
          ]
        };
      } else {
        collegeQuery = { acceptedExams: { $regex: regexPattern, $options: 'i' } };
      }

      const colleges = await College.find(collegeQuery, 'id name shortName isPremium').sort({ isPremium: -1, name: 1 }).limit(20).lean();

      const acceptedCollegesResolved = colleges.map(c => ({
        id: c.id,
        name: c.name,
        shortName: c.shortName
      }));

      const syllabus = exam.syllabus && exam.syllabus.length > 0
        ? exam.syllabus
        : syllabusById[exam.id];

      // Approximate total count
      const acceptedCount = await College.countDocuments(collegeQuery);

      return {
        ...exam,
        syllabus,
        acceptedCount,
        acceptedCollegesResolved,
      };
    }));

    cache.set(key, normalizedExams, 300);
    res.json(normalizedExams);
  } catch (error) {
    console.error("Error fetching exams from MongoDB:", error);
    res.status(500).json({ error: "Failed to load exams" });
  }
});

router.get("/exam/:id", async (req, res) => {
  try {
    const exam = await Exam.findOne({ id: req.params.id }).lean();
    if (!exam) return res.status(404).json({ error: "Exam not found" });

    const examKeys = [exam.id, exam.shortName, exam.name].filter(Boolean);
    const regexPattern = examKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    let collegeQuery = {};
    if (exam.collegesAccepting && exam.collegesAccepting.length > 0) {
      collegeQuery = {
        $or: [
          { id: { $in: exam.collegesAccepting } },
          { acceptedExams: { $regex: regexPattern, $options: 'i' } }
        ]
      };
    } else {
      collegeQuery = { acceptedExams: { $regex: regexPattern, $options: 'i' } };
    }

    // Fetch top colleges accepting this exam
    const colleges = await College.find(collegeQuery, 'id name shortName isPremium').sort({ isPremium: -1, name: 1 }).limit(50).lean();
    const acceptedCount = await College.countDocuments(collegeQuery);

    const acceptedCollegesResolved = colleges.map(c => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName
    }));

    const syllabus = exam.syllabus && exam.syllabus.length > 0
      ? exam.syllabus
      : syllabusById[exam.id];

    res.json({
      ...exam,
      syllabus,
      acceptedCount,
      acceptedCollegesResolved,
    });
  } catch (error) {
    console.error("Error fetching exam by ID:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
