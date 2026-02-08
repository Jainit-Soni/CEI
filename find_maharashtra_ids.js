const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, 'backend/models/Maharashtra_Colleges.json');

function loadJson(file) {
    if (!fs.existsSync(file)) return [];
    const content = fs.readFileSync(file, 'utf8');
    // Strip BOM if present
    const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
    return JSON.parse(cleanContent);
}

function find() {
    console.log("🔍 Searching Maharashtra Colleges...");
    const colleges = loadJson(COLLEGES_FILE);
    console.log(`Total Colleges: ${colleges.length}`);

    const keywords = [
        "VJTI", "Veermata",
        "COEP", "Pune Institute", "College of Engineering Pune",
        "Sardar Patel", "SPIT",
        "Sanghvi", "D.J.",
        "Walchand",
        "Vishwakarma", "VIT",
        "PICT"
    ];

    const found = {};

    colleges.forEach(c => {
        keywords.forEach(k => {
            if (
                c.name.toLowerCase().includes(k.toLowerCase()) ||
                (c.shortName && c.shortName.toLowerCase().includes(k.toLowerCase())) ||
                c.id.toLowerCase().includes(k.toLowerCase())
            ) {
                if (!found[k]) found[k] = [];
                found[k].push({ id: c.id, name: c.name });
            }
        });
    });

    console.log(JSON.stringify(found, null, 2));
}

find();
