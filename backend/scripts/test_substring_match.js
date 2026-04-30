const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const College = require('../models/CollegeSchema');

function loadNdjson(filename) {
    const fullPath = path.join(__dirname, '../data/truth', filename);
    if (!fs.existsSync(fullPath)) return [];
    return fs.readFileSync(fullPath, 'utf-8')
        .split('\n')
        .filter(l => l.trim())
        .map(l => { try { return JSON.parse(l); } catch(e) { return null; } })
        .filter(Boolean);
}

const feesData = loadNdjson('pan_india_bulk_2024.ndjson').filter(r => r.entityType === 'fee');
const placData = [
    ...loadNdjson('placements_iceberg_bulk.ndjson'),
    ...loadNdjson('nirf_expanded_2024_v1.ndjson')
];

function normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\b(college|institute|of|engineering|technology|and|sciences|university|for|women|dr|sri|govt|government|polytechnic|management|science|national)\b/g, '')
        .replace(/\s+/g, '')
        .trim();
}

async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const allColleges = await College.find({}, { name: 1, institution_id: 1, fees: 1, placements: 1, ceiScore: 1, institutionStrengthScore: 1 }).lean();
    
    let matchCount = 0;
    
    for (const c of allColleges) {
        const hasFees = c.fees?.isVerified || c.fees?.totalFee;
        const hasPlac = c.placements?.isVerified || c.placements?.averagePackage;
        if (hasFees && hasPlac) continue;

        const cNN = normalizeName(c.name);
        if (!cNN || cNN.length < 5) continue;

        const fMatch = feesData.find(f => {
            const fNN = normalizeName(f.name);
            return fNN.length > 5 && (fNN === cNN || fNN.includes(cNN) || cNN.includes(fNN));
        });

        const pMatch = placData.find(p => {
            const pNN = normalizeName(p.name);
            return pNN.length > 5 && (pNN === cNN || pNN.includes(cNN) || cNN.includes(pNN));
        });

        if (fMatch && pMatch) {
            matchCount++;
        }
    }

    console.log(`Matched ${matchCount} colleges using substring matching!`);
    process.exit(0);
}
run();
