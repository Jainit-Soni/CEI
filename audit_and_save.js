const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'models', 'Gujarat_Colleges.json');
const content = fs.readFileSync(filePath, 'utf8');
const colleges = JSON.parse(content);

let pendingIds = [];

colleges.forEach(col => {
    const has2025 = col.pastCutoffs.some(pc => pc.year === "2025");
    if (!has2025) {
        pendingIds.push({ id: col.id, name: col.name });
    }
});

fs.writeFileSync('pending_colleges.json', JSON.stringify(pendingIds, null, 2));
console.log(`Saved ${pendingIds.length} pending colleges to pending_colleges.json`);
