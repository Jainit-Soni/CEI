const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, 'backend/models');

function getCount(file) {
    if (!fs.existsSync(file)) return 0;
    try {
        const content = fs.readFileSync(file, 'utf8');
        const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
        const json = JSON.parse(cleanContent);
        return Array.isArray(json) ? json.length : 0;
    } catch (e) {
        return 0;
    }
}

function countAll() {
    console.log("📊 Database Stats (Full Audit):");
    console.log(`-----------------------------------`);

    const files = fs.readdirSync(MODELS_DIR).filter(f => f.endsWith('_Colleges.json'));
    let total = 0;

    // Sort by count descending for better view
    const stats = files.map(f => {
        const count = getCount(path.join(MODELS_DIR, f));
        return { file: f.replace('_Colleges.json', '').replace(/_/g, ' '), count };
    }).sort((a, b) => b.count - a.count);

    stats.forEach(s => {
        console.log(`📍 ${s.file.padEnd(30)}: ${s.count}`);
        total += s.count;
    });

    console.log(`-----------------------------------`);
    console.log(`🔥 GRAND TOTAL:            ${total}`);
}

countAll();
