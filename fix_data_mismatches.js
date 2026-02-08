const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'models', 'Gujarat_Colleges.json');
const content = fs.readFileSync(filePath, 'utf8');
const colleges = JSON.parse(content);

let updatedCount = 0;

// Specific fixes based on debug output
const fixes = {
    'au-ahmedabad': { addAccepted: ['gujcet'] }, // Had cutoff but not in accepted
    'st-xaviers-ahmedabad': { addAccepted: ['hsc-merit'] } // Had cutoff but not in accepted
};

colleges.forEach(col => {
    if (fixes[col.id]) {
        console.log(`Fixing ${col.name} (${col.id})...`);
        const fix = fixes[col.id];

        if (fix.addAccepted) {
            fix.addAccepted.forEach(examId => {
                if (!col.acceptedExams.includes(examId)) {
                    col.acceptedExams.push(examId);
                    console.log(`  Added '${examId}' to acceptedExams`);
                }
            });
        }
        updatedCount++;
    }
});

if (updatedCount > 0) {
    fs.writeFileSync(filePath, JSON.stringify(colleges, null, 2), 'utf8');
    console.log(`Updated ${updatedCount} colleges. Saved to ${filePath}`);
} else {
    console.log("No changes needed.");
}
