const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });
const fs = require('fs');
const path = require('path');

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        // 1. Get all core institutions from Mongo
        const institutions = await db.collection('institutions').find({ isCore: true }).toArray();
        const mongoIdMap = {};
        institutions.forEach(i => {
           mongoIdMap[i.name] = i.id;
        });

        // 2. Load the current registry
        const mappingPath = path.join(__dirname, '..', 'data', 'truth', 'core_id_mapping_batch1.json');
        const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

        console.log('--- Identity Mismatch Audit ---');
        let mismatches = 0;
        
        const correctedMap = {};

        Object.keys(mapping.engineering_map).forEach(name => {
            // Find best match in mongoIdMap
            // Simple exact name match for now
            const actualId = mongoIdMap[name];
            const registryId = mapping.engineering_map[name];

            if (actualId && actualId !== registryId) {
                console.log(`[MISMATCH] ${name}: Registry says ${registryId}, Mongo says ${actualId}`);
                mismatches++;
                correctedMap[name] = actualId;
            } else if (!actualId) {
                // Secondary check: partial match or alias?
                // For now just report missing
                // console.log(`[MISSING] ${name}: In Registry but not in Institutions`);
            }
        });

        console.log(`\nTotal Mismatches Found: ${mismatches}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
