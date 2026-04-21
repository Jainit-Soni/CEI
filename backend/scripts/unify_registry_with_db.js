const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });
const fs = require('fs');
const path = require('path');

async function unify() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        // 1. Get all institutions from Mongo
        const institutions = await db.collection('institutions').find({}).toArray();
        const mongoIdMap = {};
        institutions.forEach(i => {
           mongoIdMap[i.name] = i.id;
        });

        // 2. Load current registry
        const mappingPath = path.join(__dirname, '..', 'data', 'truth', 'core_id_mapping_batch1.json');
        const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

        const unifiedMapping = { ...mapping };
        
        let changes = 0;

        // Process Engineering Map
        Object.keys(mapping.engineering_map).forEach(name => {
            const actualId = mongoIdMap[name];
            const currentId = mapping.engineering_map[name];
            if (actualId && actualId !== currentId) {
                unifiedMapping.engineering_map[name] = actualId;
                changes++;
            }
        });

        // Process MCC Map (More complex, mcc_map is mcc_id -> id)
        // We need to resolve the MCC institutions too.
        // For now, let's just focus on the core engineering/flagship names.

        console.log(`--- Unification Summary ---`);
        console.log(`Total ID Corrections: ${changes}`);

        fs.writeFileSync(mappingPath, JSON.stringify(unifiedMapping, null, 2));
        console.log(`✅ Registry unified and written back to ${mappingPath}`);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

unify();
