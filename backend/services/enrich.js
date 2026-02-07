const { sources } = require("./sourceRegistry");

async function enrichCollege(college) {
  return {
    ...college,
    sources
  };
}

async function enrichExam(exam) {
  return {
    ...exam,
    sources
  };
}

module.exports = { enrichCollege, enrichExam };
