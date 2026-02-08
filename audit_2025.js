const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'models', 'Gujarat_Colleges.json');
const content = fs.readFileSync(filePath, 'utf8');
const colleges = JSON.parse(content);

const pendingColleges = [];
const updatedColleges = [];

colleges.forEach(col => {
    let has2025 = false;
    let isPending = true;

    if (col.pastCutoffs && Array.isArray(col.pastCutoffs)) {
        col.pastCutoffs.forEach(cutoff => {
            if (cutoff.year === "2025") {
                has2025 = true;
            }
            if (cutoff.cutoff !== "Check official website" && cutoff.cutoff !== "Data Pending") {
                isPending = false;
            }
        });
    }

    if (has2025 && !isPending) {
        updatedColleges.push(col.name);
    } else {
        pendingColleges.push({
            id: col.id,
            name: col.name,
            reason: has2025 ? "Has 2025 but value pending" : "No 2025 data"
        });
    }
});

console.log(`Total Colleges: ${colleges.length}`);
console.log(`Updated (2025): ${updatedColleges.length}`);
console.log(`Pending: ${pendingColleges.length}`);
console.log("\n--- Pending Colleges ---");
pendingColleges.forEach(p => console.log(`[${p.id}] ${p.name} (${p.reason})`));
