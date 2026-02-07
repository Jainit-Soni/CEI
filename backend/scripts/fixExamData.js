const fs = require('fs');
const path = require('path');
const { getColleges, getExams } = require("./services/dataStore");
const Fuse = require('fuse.js');

console.log("Loading data for fixing...");
const colleges = getColleges();
const exams = getExams();
const EXAMS_FILE = path.join(__dirname, 'models', 'exams.json');

const collegeIds = new Set(colleges.map(c => c.id));

// Fuzzy search setup
const fuse = new Fuse(colleges, {
    keys: ['id', 'name', 'shortName', 'location'],
    threshold: 0.4,
});

let changes = 0;
let fixedCount = 0;
let manualCheckCount = 0;

exams.forEach(exam => {
    if (exam.collegesAccepting) {
        const newAccepting = [];
        exam.collegesAccepting.forEach(collegeId => {
            if (collegeIds.has(collegeId)) {
                newAccepting.push(collegeId);
            } else {
                console.log(`\nMissing: ${collegeId} (in ${exam.id})`);

                // Try simple replacements first (common pattern differences)
                let potentialId = collegeId;

                // 1. Try "iit-delhi" -> "indian-institute-of-technology-delhi" or similar
                // Actually, let's trust Fuse.js

                // Search for best match
                const result = fuse.search(collegeId);

                if (result.length > 0) {
                    const bestMatch = result[0].item;
                    console.log(`  -> Fixed to: ${bestMatch.id} (${bestMatch.name})`);
                    newAccepting.push(bestMatch.id);
                    changes++;
                    fixedCount++;
                } else {
                    console.warn(`  [!] No match found for: ${collegeId}`);
                    // Keep original so we don't lose data, but mark it
                    newAccepting.push(collegeId);
                    manualCheckCount++;
                }
            }
        });
        exam.collegesAccepting = newAccepting;
    }
});

if (changes > 0) {
    console.log(`\nWriting ${changes} fixes to exams.json...`);
    fs.writeFileSync(EXAMS_FILE, JSON.stringify(exams, null, 2));
    console.log("Done.");
} else {
    console.log("\nNo changes made.");
}

console.log(`Fixed: ${fixedCount}, Unresolved: ${manualCheckCount}`);
