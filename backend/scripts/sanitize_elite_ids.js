/**
 * backend/scripts/sanitize_elite_ids.js
 * =====================================
 * Consolidates elite flagship IDs from long-form to short-form.
 * 1. Updates identity_registry.json
 * 2. Updates MongoDB institutions collection
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const REGISTRY_PATH = path.join(__dirname, '..', 'data', 'truth', 'identity_registry.json');

async function sanitize() {
    try {
        console.log('Loading Identity Registry...');
        let registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        
        const newRegistry = {};
        let registryChanges = 0;

        for (const [id, meta] of Object.entries(registry)) {
            let newId = id;
            
            // 1. Convert IITs
            if (id.startsWith('CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-')) {
                const city = id.replace('CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-', '');
                newId = `CORE-IIT-${city}`;
            }
            // 2. Convert NITs
            else if (id.startsWith('CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-')) {
                const city = id.replace('CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-', '');
                newId = `CORE-NIT-${city}`;
            }

            if (newId !== id) {
                console.log(`♻️  Registry ID: ${id} -> ${newId}`);
                registryChanges++;
                
                // Merge if target exists, else create
                if (newRegistry[newId]) {
                    console.log(`   Merging into existing ${newId}...`);
                    newRegistry[newId].aliases = [...new Set([...(newRegistry[newId].aliases || []), ...(meta.aliases || []), meta.canonical_name])];
                } else {
                    newRegistry[newId] = meta;
                }
            } else {
                newRegistry[id] = meta;
            }
        }

        if (registryChanges > 0) {
            console.log(`\nSaving ${registryChanges} changes to registry...`);
            fs.writeFileSync(REGISTRY_PATH, JSON.stringify(newRegistry, null, 2));
        }

        // --- MONGODB SANITIZATION ---
        console.log('\nConnecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        const collections = ['institutions', 'engineering_cutoffs', 'seat_matrix'];
        
        for (const collName of collections) {
            console.log(`\nSanitizing ${collName}...`);
            const collection = db.collection(collName);

            // Fetch all documents with long IDs
            const longDocs = await collection.find({
                $or: [
                    { id: { $regex: /^CORE-(INDIAN-INSTITUTE-OF-TECHNOLOGY|NATIONAL-INSTITUTE-OF-TECHNOLOGY)-/ } },
                    { institution_id: { $regex: /^CORE-(INDIAN-INSTITUTE-OF-TECHNOLOGY|NATIONAL-INSTITUTE-OF-TECHNOLOGY)-/ } }
                ]
            }).toArray();

            console.log(`Found ${longDocs.length} documents to sanitize in ${collName}.`);

            for (const doc of longDocs) {
                let currentId = doc.id || doc.institution_id;
                let newId = currentId;

                if (currentId.startsWith('CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-')) {
                    newId = `CORE-IIT-${currentId.replace('CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-', '')}`;
                } else if (currentId.startsWith('CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-')) {
                    newId = `CORE-NIT-${currentId.replace('CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-', '')}`;
                }

                if (newId !== currentId) {
                    const update = doc.id ? { id: newId } : { institution_id: newId };
                    await collection.updateOne({ _id: doc._id }, { $set: update });
                }
            }
            console.log(`✅ Sanitize ${collName} complete.`);
        }

        console.log('\n--- SANITIZATION COMPLETE ---');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

sanitize();
