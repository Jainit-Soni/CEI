const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'models', 'Gujarat_Colleges.json');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const searchStrings = [
    'College Gandhinagar'
];

console.log("Searching for strings in " + filePath);
searchStrings.forEach(str => {
    lines.forEach((line, index) => {
        if (line.includes(str)) {
            let id = "UNKNOWN";
            for (let i = index; i >= Math.max(0, index - 20); i--) {
                if (lines[i].trim().startsWith('"id":')) {
                    id = lines[i].trim().replace('"id":', '').replace(',', '').replace(/"/g, '').trim();
                    break;
                }
            }
            console.log(`Found "${str}" match at line ${index + 1}: ${line.trim()} (ID: ${id})`);
        }
    });
});
