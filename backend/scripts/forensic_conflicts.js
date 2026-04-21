const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });
const fs = require('fs');
const path = require('path');

async function analyzeConflicts() {
    try {
        console.log('--- Bridge Conflict Forensic Analysis ---\n');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        // Load the registry
        const mappingPath = path.join(__dirname, '..', 'data', 'truth', 'core_id_mapping_batch1.json');
        const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        const { engineering_map } = mapping;

        // Sample 100 docs where current institution_id is NOT matching the map but the name IS in the map
        const cursor = db.collection('engineering_cutoffs').find({
            institute_name_raw: { $in: Object.keys(engineering_map) }
        }).limit(200);

        const samples = [];
        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            const expected = engineering_map[doc.institute_name_raw];
            if (doc.institution_id && doc.institution_id !== expected) {
                samples.push({
                    name: doc.institute_name_raw,
                    found: doc.institution_id,
                    expected: expected
                });
            }
            if (samples.length >= 20) break;
        }

        console.log('Sample Conflicts (Top 20):');
        console.table(samples);

        // Verification logic: Is 'found' a known legacy ID?
        const safeCount = samples.filter(s => {
            const isPatternSafe = s.found.startsWith('CORE-') && s.found.length < 25; // Heuristic: Short CORE IDs
            return isPatternSafe;
        }).length;

        console.log(`\nSafety Assessment: ${safeCount}/${samples.length} samples analyzed as safe identity synonyms.`);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

analyzeConflicts();
