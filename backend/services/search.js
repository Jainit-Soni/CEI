const Fuse = require("fuse.js");
const { getColleges, getExams } = require("./dataStore");

// Cached search indices
let collegeFuseIndex = null;
let examFuseIndex = null;

function buildFuse(items, keys) {
  return new Fuse(items, {
    keys,
    threshold: 0.35,
    ignoreLocation: true,
  });
}

// Initialize indices
async function initializeSearchIndices() {
  // If already initialized, return
  if (collegeFuseIndex && examFuseIndex) return;

  console.log("Building search indices...");
  const colleges = await getColleges();
  const exams = await getExams();

  collegeFuseIndex = buildFuse(colleges, ["name", "shortName", "district", "state", "courses.name"]);
  examFuseIndex = buildFuse(exams, ["name", "shortName", "type", "syllabus"]);

  console.log("Search indices built successfully");
}

// Get cached college search index
async function getCollegeFuse() {
  if (!collegeFuseIndex) {
    await initializeSearchIndices();
  }
  return collegeFuseIndex;
}

// Get cached exam search index
async function getExamFuse() {
  if (!examFuseIndex) {
    await initializeSearchIndices();
  }
  return examFuseIndex;
}

// Rebuild indices (call when data changes)
async function rebuildIndices() {
  console.log("Rebuilding search indices...");
  collegeFuseIndex = null;
  examFuseIndex = null;
  await initializeSearchIndices();
}

// Start initialization in background
initializeSearchIndices().catch(err => console.error("Failed to init search indices:", err));

module.exports = {
  buildFuse,
  getCollegeFuse,
  getExamFuse,
  rebuildIndices
};
