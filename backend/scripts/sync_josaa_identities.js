/**
 * backend/scripts/sync_josaa_identities.js
 * ========================================
 * Enforces josaa_code as the authoritative join key.
 * Updates engineering_cutoffs and seat_matrix based on josaa_institutes crosswalk.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function sync() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        console.log('Loading JoSAA Crosswalk Index...');
        const crosswalkDocs = await db.collection('josaa_institutes').find({}).toArray();
        const codeToId = new Map();
        const codeToName = new Map();

        crosswalkDocs.forEach(doc => {
            if (doc.institution_id && doc.institution_id !== 'UNLINKED') {
                codeToId.set(doc.josaa_code, doc.institution_id);
                codeToName.set(doc.josaa_code, doc.institute_name_official);
            }
        });

        console.log(`Loaded ${codeToId.size} verified mappings.`);

        const collections = ['engineering_cutoffs', 'seat_matrix'];
        
        for (const collName of collections) {
            console.log(`\nProcessing ${collName}...`);
            const collection = db.collection(collName);

            // 1. Update documents that HAVE josaa_code
            console.log(`- Syncing documents with josaa_code...`);
            let syncCount = 0;
            for (const [code, institution_id] of codeToId.entries()) {
                const result = await collection.updateMany(
                    { josaa_code: code },
                    { 
                        $set: { 
                            institution_id: institution_id,
                            josaa_link_status: 'LINKED_VIA_CODE',
                            josaa_verified: true
                        } 
                    }
                );
                syncCount += result.modifiedCount;
            }
            console.log(`  ✅ Synced ${syncCount} documents.`);

            // 2. Mark documents with MISSING josaa_code as UNLINKED
            // Only for JoSAA records
            console.log(`- Marking unlinked JoSAA records...`);
            const unlinkedResult = await collection.updateMany(
                { 
                    source_authority: { $in: ['JOSAA', 'CSAB', 'JoSAA', 'csab'] },
                    josaa_code: { $exists: false }
                },
                { 
                    $set: { 
                        josaa_link_status: 'UNLINKED',
                        josaa_verified: false
                    } 
                }
            );
            console.log(`  ⚠️ Marked ${unlinkedResult.modifiedCount} records as UNLINKED.`);
            
            // 3. Remove name dependency (optional: unset name-based fields or mark them as secondary)
            // The user said "Remove dependency on institute_name_raw".
            // We will NOT delete the data yet, but we will ensure it's not used for joins.
        }

        console.log('\n--- Sync Complete ---');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

sync();
