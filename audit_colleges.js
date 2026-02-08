const fs = require('fs');
const path = require('path');

const collegesPath = path.join(__dirname, 'backend', 'models', 'Gujarat_Colleges.json');

try {
    const rawData = fs.readFileSync(collegesPath, 'utf8');
    const colleges = JSON.parse(rawData);

    console.log(`Auditing ${colleges.length} colleges...`);
    console.log("---------------------------------------------------");

    let missingCutoffCount = 0;
    let pendingDataCount = 0;

    colleges.forEach(college => {
        const accepted = college.acceptedExams || [];
        const cutoffs = college.pastCutoffs || [];
        const missing = [];
        const pending = [];

        accepted.forEach(exam => {
            const cutoffEntry = cutoffs.find(c => c.examId === exam);
            if (!cutoffEntry) {
                missing.push(exam);
            } else if (cutoffEntry.cutoff === "Check official website") {
                pending.push(exam);
            }
        });

        if (missing.length > 0 || pending.length > 0) {
            console.log(`[${college.id}] ${college.name}`);
            if (missing.length > 0) console.log(`  MISSING CUTOFFS: ${missing.join(', ')}`);
            if (pending.length > 0) console.log(`  DATA PENDING (Placeholder): ${pending.join(', ')}`);
            if (missing.length > 0) missingCutoffCount++;
            if (pending.length > 0) pendingDataCount++;
        }
    });

    console.log("---------------------------------------------------");
    console.log(`Summary:`);
    console.log(`Colleges with COMPLETELY MISSING cutoff entries: ${missingCutoffCount}`);
    console.log(`Colleges with 'Check official website' placeholders: ${pendingDataCount}`);

} catch (err) {
    console.error("Error reading or parsing file:", err);
}
