const { getColleges, getExams } = require("./services/dataStore");

console.log("Loading data...");
const colleges = getColleges();
const exams = getExams();

console.log(`Loaded ${colleges.length} colleges and ${exams.length} exams.`);

const collegeIds = new Set(colleges.map(c => c.id));
const examIds = new Set(exams.map(e => e.id));

console.log("\nVerifying Exam -> College references (collegesAccepting):");
let missingColleges = 0;
exams.forEach(exam => {
    if (exam.collegesAccepting) {
        exam.collegesAccepting.forEach(collegeId => {
            if (!collegeIds.has(collegeId)) {
                console.warn(`[Missing College] Exam '${exam.id}' refers to missing college '${collegeId}'`);
                missingColleges++;
            }
        });
    }
});

console.log("\nVerifying College -> Exam references (acceptedExams):");
let missingExams = 0;
colleges.forEach(college => {
    if (college.admissionModes) {
        college.admissionModes.forEach(mode => {
            if (mode.examId && !examIds.has(mode.examId) && mode.examId !== "merit" && mode.examId !== "class-12") {
                // Some colleges might have specific exams not in our main list, but let's warn
                console.warn(`[Missing Exam] College '${college.id}' refers to missing exam '${mode.examId}'`);
                missingExams++;
            }
        });
    }
});

console.log("\n--------------------------------------------------");
console.log(`Verification Complete.`);
console.log(`Missing College References: ${missingColleges}`);
console.log(`Missing Exam References: ${missingExams}`);
console.log("--------------------------------------------------");
