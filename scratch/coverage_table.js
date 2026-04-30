const fs = require('fs');
const path = require('path');

const catalog = fs.readFileSync('backend/data/colleges_new.ndjson', 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const truthDir = 'backend/data/truth';
const truthFiles = fs.readdirSync(truthDir).filter(f => f.endsWith('.ndjson'));

const truthMap = new Map();
truthFiles.forEach(file => {
    const lines = fs.readFileSync(path.join(truthDir, file), 'utf8').split('\n').filter(Boolean);
    lines.forEach(l => {
        try {
            const d = JSON.parse(l);
            const id = d.collegeId || d.stableKey;
            if (!id) return;
            if (!truthMap.has(id)) truthMap.set(id, []);
            truthMap.get(id).push(d);
        } catch {}
    });
});

const results = ['placements', 'fees', 'courses', 'seats', 'cutoffs'].map(s => {
    let available = 0;
    catalog.forEach(c => {
        const id = c.id || c.stableKey;
        const truths = truthMap.get(id) || [];
        
        let hasData = false;
        if (s === 'placements') hasData = c.placements && c.placements.averagePackageNumeric > 0;
        else if (s === 'fees') hasData = c.fees && c.fees.totalNumeric > 0;
        else if (s === 'courses') hasData = c.courses && c.courses.length > 0;
        else if (s === 'seats') hasData = truths.some(t => t.entityType === 'counsellingSeatMatrix');
        else if (s === 'cutoffs') hasData = truths.some(t => t.entityType === 'counsellingCutoff');

        if (hasData) available++;
    });

    return {
        section: s,
        catalog_visible: catalog.length,
        available: available,
        method: 'Live NDJSON Bridge'
    };
});

console.table(results);
