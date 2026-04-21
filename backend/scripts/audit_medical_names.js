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

        console.log(`Auditing names for ${Object.keys(mcc_map).length} MCC entries...`);

        const medical_identity_crosswalk = {};

        for (const [mccId, legacyId] of Object.entries(mcc_map)) {
            // Find a sample document in medical_seat_matrix to get the name
            const sample = await db.collection('medical_seat_matrix').findOne({ mcc_id: mccId });
            const name = sample?.institute_name_raw || sample?.normalized_name || `UNKNOWN_MCC_${mccId}`;
            
            // Now resolve this name in institutions
            const inst = await db.collection('institutions').findOne({ name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
            
            medical_identity_crosswalk[mccId] = {
                legacy_name: name,
                legacy_id: legacyId,
                actual_id: inst?.id || null,
                actual_name: inst?.name || null
            };

            if (inst) {
                console.log(`[OK] MCC ${mccId} ("${name}") -> ${inst.id}`);
            } else {
                console.log(`[WARN] MCC ${mccId} ("${name}") -> UNRESOLVED`);
            }
        }

        const medicalArtifactPath = path.join(__dirname, '..', 'data', 'truth', 'medical_identity_audit.json');
        fs.writeFileSync(medicalArtifactPath, JSON.stringify(medical_identity_crosswalk, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

const fs = require('fs');
run();
