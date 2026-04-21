const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        // Load the registry medical map
        const registryPath = path.join(__dirname, '..', 'data', 'truth', 'core_id_mapping_batch1.json');
        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        const { mcc_map } = registry;

        console.log(`Processing ${Object.keys(mcc_map).length} MCC entries...`);

        for (const [mccId, legacyId] of Object.entries(mcc_map)) {
            const inst = await db.collection('institutions').findOne({ mcc_id: mccId });
            if (inst) {
                console.log(`[FOUND] MCC ${mccId} -> ${inst.name} [Actual ID: ${inst.id}] (Legacy ID: ${legacyId})`);
            } else {
                console.log(`[MISSING] MCC ${mccId} not found in institutions collection.`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

const fs = require('fs');
run();
