const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const fs = require('fs');

const DRY_RUN = process.env.DRY_RUN !== 'false';
const VERSION = 'batch1_identity_unification_v1';

async function runBridge() {
    try {
        console.log(`--- CEI Reconciled Bridge [DRY_RUN: ${DRY_RUN}] ---`);
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        // 1. Load Reconciliation Artifact
        const artifactPath = path.join(__dirname, '..', 'data', 'truth', 'identity_reconciliation_batch1.json');
        if (!fs.existsSync(artifactPath)) throw new Error('Reconciliation artifact not found');
        const reconciliation = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

        // 2. Build Remap Index (Legacy ID -> Actual ID)
        const remapIndex = {};
        reconciliation.reconciliation_set.forEach(r => {
            if (r.approved && r.actual_institution_id) {
                remapIndex[r.legacy_institution_id] = r.actual_institution_id;
            }
        });

        const collections = ['engineering_cutoffs', 'seat_matrix', 'medical_seat_matrix'];
        const stats = {};

        for (const colName of collections) {
            console.log(`Processing ${colName}...`);
            const collection = db.collection(colName);
            
            stats[colName] = { scanned: 0, recoded: 0, unchanged: 0, skipped_unresolved: 0, skipped_out_of_scope: 0 };

            const cursor = collection.find({});
            const total = await collection.countDocuments({});
            stats[colName].total = total;

            while (await cursor.hasNext()) {
                const doc = await cursor.next();
                stats[colName].scanned++;
                if (stats[colName].scanned % 5000 === 0) process.stdout.write('.');

                const currentId = doc.institution_id;
                
                // Skip rows without an id stamp
                if (!currentId) {
                    stats[colName].skipped_unresolved++;
                    continue;
                }

                const targetId = remapIndex[currentId];

                // If already on the target ID, mark unchanged
                if (currentId === targetId) {
                    stats[colName].unchanged++;
                    continue;
                }

                // If no entry in the approved crosswalk, it's out of scope for this pass
                if (!targetId) {
                    stats[colName].skipped_out_of_scope++;
                    continue;
                }

                // We have a match in the crosswalk and it's a REMAP
                stats[colName].recoded++;

                if (!DRY_RUN) {
                    await collection.updateOne(
                        { _id: doc._id },
                        { 
                            $set: { 
                                institution_id: targetId,
                                institution_id_legacy: currentId,
                                reconciliation_version: VERSION,
                                reconciliation_updated_at: new Date()
                            } 
                        }
                    );
                }
            }
            console.log('\n');
        }

        console.log('\n--- BRIDGE EXECUTION SUMMARY ---');
        console.table(stats);

        if (DRY_RUN) {
            console.log('\n💡 This was a DRY RUN. No changes were committed.');
            console.log('To execute, run: DRY_RUN=false node backend/scripts/reconciled_bridge_batch1.js');
        } else {
            console.log('\n✅ SUCCESS: Identity unification pass complete.');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

runBridge();
