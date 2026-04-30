const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const College = require('../models/CollegeSchema');
const TRUTH_DIR = path.join(__dirname, '../data/truth');

function loadNdjson(filename) {
    const fullPath = path.join(TRUTH_DIR, filename);
    if (!fs.existsSync(fullPath)) return [];
    const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
    const records = [];
    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            records.push(JSON.parse(line));
        } catch (e) {}
    }
    return records;
}

const data = loadNdjson('nirf_expanded_2024_v1.ndjson');

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
    const allColleges = await College.find({}, { name: 1, institution_id: 1, state: 1 }).lean();
    console.log(`Loaded ${allColleges.length} colleges.`);

    let matchCount = 0;
    
    for (const item of data) {
        const nf = normalizeName(item.name);
        if (!nf || nf.length < 3) continue;

        const matched = allColleges.filter(c => normalizeName(c.name) === nf);
        if (matched.length === 1) {
            matchCount++;
        }
    }

    console.log(`Matched ${matchCount} out of ${data.length} records in nirf_expanded_2024_v1.`);
    process.exit(0);
}
run().catch(console.error);
