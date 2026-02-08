const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'models', 'Gujarat_Colleges.json');
const content = fs.readFileSync(filePath, 'utf8');
const colleges = JSON.parse(content);

console.log("Checking College vs Exam dropdown logic...");

colleges.forEach(col => {
    const accepted = col.acceptedExams || [];
    const courseExams = (col.courses || []).flatMap(c => c.exams || []);
    const allAccepted = [...new Set([...accepted, ...courseExams])];

    // Check if pastCutoffs exist for these exams
    const pastCutoffExams = (col.pastCutoffs || []).map(p => p.examId);

    const missingCutoffs = allAccepted.filter(exam => !pastCutoffExams.includes(exam));
    const extraCutoffs = pastCutoffExams.filter(exam => !allAccepted.includes(exam));

    if (missingCutoffs.length > 0 || extraCutoffs.length > 0) {
        console.log(`\nCollege: ${col.name} (${col.id})`);
        console.log(`  Accepted Exams: [${allAccepted.join(', ')}]`);
        console.log(`  Past Cutoffs:   [${pastCutoffExams.join(', ')}]`);
        if (missingCutoffs.length > 0) console.log(`  ⚠ MISSING CUTOFFS: ${missingCutoffs.join(', ')}`);
        if (extraCutoffs.length > 0) console.log(`  ⚠ CUTOFFS WITHOUT ACCEPTED: ${extraCutoffs.join(', ')}`);
    }
});
