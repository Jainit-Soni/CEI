const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, 'backend/models');

function countColleges() {
    let total = 0;
    const files = fs.readdirSync(MODELS_DIR).filter(f => f.endsWith('_Colleges.json'));

    let allIds = new Set();
    let duplicates = [];

    files.forEach(file => {
        const content = fs.readFileSync(path.join(MODELS_DIR, file), 'utf8');
        try {
            const data = JSON.parse(content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content);
            total += data.length;

            data.forEach(c => {
                if (allIds.has(c.id)) {
                    duplicates.push({ id: c.id, file: file });
                }
                allIds.add(c.id);
            });

            console.log(`${file}: ${data.length}`);
        } catch (e) {
            console.error(`Error parsing ${file}:`, e.message);
        }
    });

    console.log(`\n---------------------------------`);
    console.log(`TOTAL COLLEGES IN DB: ${total}`);
    console.log(`UNIQUE COLLEGES (by ID): ${allIds.size}`);

    if (duplicates.length > 0) {
        console.log(`\n⚠️ DUPLICATES FOUND (${duplicates.length}):`);
        duplicates.forEach(d => console.log(`   - ${d.id} in ${d.file}`));
    }
}

countColleges();
