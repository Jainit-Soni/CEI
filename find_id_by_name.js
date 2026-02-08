const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'models', 'Gujarat_Colleges.json');
const content = fs.readFileSync(filePath, 'utf8');
const colleges = JSON.parse(content);

const targetNames = [
    "Government Engineering College Gandhinagar",
    "Government Engineering College Patan",
    "Government Engineering College Dahod",
    "Government Engineering College Bharuch",
    "Government Engineering College, Patan", // Try variations
    "Government Engineering College, Dahod",
    "Government Engineering College, Bharuch",
    "GEC Patan",
    "GEC Dahod",
    "GEC Bharuch"
];

console.log(`Searching ${colleges.length} colleges...`);

targetNames.forEach(name => {
    const col = colleges.find(c => c.name === name || c.name.includes(name));
    if (col) {
        console.log(`FOUND: "${name}" -> Name: "${col.name}", ID: "${col.id}"`);
    } else {
        console.log(`NOT FOUND: "${name}"`);
    }
});

// Also search for any college with "Gandhinagar" in name to be sure
console.log("\n--- 'Gandhinagar' Search ---");
colleges.filter(c => c.name.includes("Gandhinagar")).forEach(c => {
    console.log(`Name: "${c.name}", ID: "${c.id}"`);
});
