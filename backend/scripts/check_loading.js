const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'models', 'Maharashtra_Colleges.json');
const fileMP = path.join(__dirname, 'models', 'Madhya_Pradesh_Colleges.json');

function check(f) {
    console.log(`Checking ${path.basename(f)}...`);
    try {
        const raw = fs.readFileSync(f, 'utf8');
        // Check for BOM
        if (raw.charCodeAt(0) === 0xFEFF) console.log("BOM detected");
        JSON.parse(raw);
        console.log("Valid JSON.");
    } catch (e) {
        console.error("Invalid JSON:", e.message);
    }
}

check(file);
check(fileMP);
