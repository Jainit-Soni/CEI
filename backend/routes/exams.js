const express = require("express");
const cache = require("../services/cache");
const Exam = require("../models/ExamSchema");
const College = require("../models/CollegeSchema");

const router = express.Router();

const syllabusById = {
  "xat": ["Verbal & Logical Ability", "Decision Making", "Quantitative Ability", "General Knowledge"],
  "cmat": ["Quantitative Techniques", "Logical Reasoning", "Language Comprehension", "General Awareness"],
  "snap": ["General English", "Analytical & Logical Reasoning", "Quantitative"],
  "gate": ["General Aptitude", "Subject-specific paper"]
};

const buildExamCollegeQuery = (exam) => {
  const examKeys = [exam.id, exam.shortName, exam.name].filter(Boolean);
  const regexPattern = examKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

  let $or = [
    { acceptedExams: { $regex: regexPattern, $options: 'i' } }
  ];

  if (exam.collegesAccepting && exam.collegesAccepting.length > 0) {
    $or.push({ id: { $in: exam.collegesAccepting } });
  }

  const categoryMap = {
    'engineering': ['b.tech', 'b.e.', 'm.tech', 'engineering', 'technology'],
    'management': ['mba', 'pgdm', 'mms', 'management', 'business'],
    'medical': ['mbbs', 'bds', 'medical', 'medicine', 'pharma', 'health', 'dental'],
    'medical & dental': ['mbbs', 'bds', 'medical', 'medicine', 'pharma', 'health', 'dental'],
    'design': ['b.des', 'm.des', 'design', 'architecture', 'b.arch'],
    'design & architecture': ['b.des', 'm.des', 'design', 'architecture', 'b.arch'],
    'law': ['llb', 'llm', 'law', 'legal', 'b.a. ll.b.'],
    'science & agriculture': ['b.sc', 'm.sc', 'science', 'agriculture', 'b.v.sc'],
    'architecture': ['b.arch', 'architecture', 'b.planning'],
    'finance/accounting': ['commerce', 'accountancy', 'ca', 'finance']
  };

  let catList = exam.category ? (categoryMap[exam.category.toLowerCase()] || []) : [];

  if (exam.courses && Array.isArray(exam.courses)) {
    exam.courses.forEach(c => {
      const low = c.toLowerCase();
      if (low === 'b.tech' || low.includes('b.e')) catList.push('b.tech', 'b.e.', 'engineering');
      else if (low === 'mba') catList.push('mba', 'pgdm');
      else if (low === 'mbbs') catList.push('mbbs');
      else catList.push(low);
    });
  }

  catList = [...new Set(catList)].filter(Boolean);

  // If it's a very specific exam like UPSC, we don't blindly map generic courses,
  // but for vast majority (Engineering/Medical), it's safe to map.
  if (catList.length > 0 && !["civil services", "government jobs", "defense", "language proficiency"].includes(exam.type?.toLowerCase())) {
    const crg = catList.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    $or.push({ 'courses.name': { $regex: crg, $options: 'i' } });
    $or.push({ 'courses.degree': { $regex: crg, $options: 'i' } });
  }

  return { $or };
};

router.get("/exams", async (req, res) => {
  try {
    const key = `mongo:exams_expanded:${JSON.stringify(req.query)}`;
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
      const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: safeQ, $options: 'i' } },
        { shortName: { $regex: safeQ, $options: 'i' } }
      ];
      sort = { name: 1 };
    }

    const exams = await Exam.find(query, projection).sort(sort).lean();

    const normalizedExams = await Promise.all(exams.map(async (exam) => {
      const collegeQuery = buildExamCollegeQuery(exam);

      // We only fetch 10 premium colleges for the overall list to keep it fast
      const colleges = await College.find(collegeQuery, 'id name shortName isPremium')
        .sort({ isPremium: -1, name: 1 })
        .limit(10)
        .lean();

      const acceptedCollegesResolved = colleges.map(c => ({
        id: c.id,
        name: c.name,
        shortName: c.shortName
      }));

      const syllabus = exam.syllabus && exam.syllabus.length > 0 ? exam.syllabus : syllabusById[exam.id];

      // Count all matching colleges (this uses the expanded query, making totals huge)
      const acceptedCount = await College.countDocuments(collegeQuery);

      return {
        ...exam,
        syllabus,
        acceptedCount,
        acceptedCollegesResolved,
      };
    }));

    cache.set(key, normalizedExams, 600);
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

    const collegeQuery = buildExamCollegeQuery(exam);

    // Fetch top 50 colleges accepting this exam for the single view
    const colleges = await College.find(collegeQuery, 'id name shortName isPremium')
      .sort({ isPremium: -1, name: 1 })
      .limit(50)
      .lean();

    const acceptedCount = await College.countDocuments(collegeQuery);

    const acceptedCollegesResolved = colleges.map(c => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName
    }));

    const syllabus = exam.syllabus && exam.syllabus.length > 0 ? exam.syllabus : syllabusById[exam.id];

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

router.get("/exam/:id/colleges", async (req, res) => {
  try {
    const { page, limit, q, state, district } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const exam = await Exam.findOne({ id: req.params.id }).lean();
    if (!exam) return res.status(404).json({ error: "Exam not found" });

    let collegeQuery = buildExamCollegeQuery(exam);
    let andConditions = [collegeQuery];

    let projection = {};
    let sort = { isPremium: -1, name: 1 };

    if (q) {
      const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andConditions.push({
        $or: [
          { name: { $regex: safeQ, $options: 'i' } },
          { shortName: { $regex: safeQ, $options: 'i' } }
        ]
      });
    }

    if (state) {
      andConditions.push({ state: { $regex: `^${state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
    }

    if (district) {
      andConditions.push({
        $or: [
          { "meta.district": { $regex: `^${district.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
          { location: { $regex: `^${district.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`, $options: 'i' } } // Fallback for location starting with City "City, State"
        ]
      });
    }

    collegeQuery = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

    const [colleges, totalCount] = await Promise.all([
      College.find(collegeQuery, 'id name shortName isPremium state rankingTier meta', projection)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      College.countDocuments(collegeQuery)
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      data: colleges.map(c => ({
        id: c.id,
        name: c.name,
        shortName: c.shortName,
        state: c.state,
        rankingTier: c.rankingTier
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      }
    });

  } catch (error) {
    console.error("Error fetching exam colleges:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
