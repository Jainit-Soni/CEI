const fs = require("fs");
const path = require("path");

const MODELS_DIR = path.join(__dirname, "..", "models");

function loadJson(file) {
    const p = path.join(MODELS_DIR, file);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    const cleaned = raw.replace(/^\uFEFF/, "");
    return JSON.parse(cleaned);
}

const exams = loadJson("exams.json") || [];
const examIds = new Set(exams.map(e => e.id));
const collegeFiles = fs.readdirSync(MODELS_DIR).filter(f => f.endsWith("_Colleges.json"));

console.log(`Auditing ${exams.length} exams and ${collegeFiles.length} college files...\n`);

let orphansExamsInColleges = 0;
let orphanCollegesInExams = 0;

const allCollegeIds = new Set();
const collegesDetails = {};

collegeFiles.forEach(file => {
    const data = loadJson(file);
    const list = Array.isArray(data) ? data : (data.institutions || data.colleges || []);
    list.forEach(c => {
        if (c.id) {
            allCollegeIds.add(c.id);
            collegesDetails[c.id] = { name: c.name, file };
        }
    });
});

console.log(`Found ${allCollegeIds.size} total colleges.\n`);

// 1. Audit Exams listed in Colleges
collegeFiles.forEach(file => {
    const data = loadJson(file);
    const list = Array.isArray(data) ? data : (data.institutions || data.colleges || []);
    list.forEach(c => {
        const accepted = c.acceptedExams || [];
        accepted.forEach(exId => {
            if (!examIds.has(exId)) {
                console.warn(`[!] College "${c.name}" (ID: ${c.id}) in ${file} accepts unknown exam: "${exId}"`);
                orphansExamsInColleges++;
            }
        });

        const courseExams = (c.courses || []).flatMap(co => co.exams || []);
        courseExams.forEach(exId => {
            if (!examIds.has(exId)) {
                console.warn(`[!] College "${c.name}" course listed unknown exam: "${exId}"`);
                orphansExamsInColleges++;
            }
        });
    });
});

// 2. Audit Colleges listed in Exams
exams.forEach(ex => {
    const accepting = ex.collegesAccepting || [];
    accepting.forEach(cId => {
        if (!allCollegeIds.has(cId)) {
            console.warn(`[!] Exam "${ex.shortName || ex.name}" lists unknown accepting college ID: "${cId}"`);
            orphanCollegesInExams++;
        }
    });
});

console.log("\n--- Audit Summary ---");
console.log(`Unknown Exams referenced by Colleges: ${orphansExamsInColleges}`);
console.log(`Unknown Colleges referenced by Exams: ${orphanCollegesInExams}`);

if (orphansExamsInColleges === 0 && orphanCollegesInExams === 0) {
    console.log("\n✅ Database Synchronization is Perfect!");
} else {
    console.log("\n❌ Issues found. Please fix the mappings.");
}
