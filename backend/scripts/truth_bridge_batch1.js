const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.env.DRY_RUN !== 'false'; // Defaults to true
const FORCE_RECODE = process.env.FORCE_RECODE === 'true'; // Defaults to false

async function bridgeTruth() {
    try {
        console.log(`--- CEI Truth Bridge [DRY_RUN: ${DRY_RUN}] ---`);
        
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        // 1. Load Registry
        const mappingPath = path.join(__dirname, '..', 'data', 'truth', 'core_id_mapping_batch1.json');
        if (!fs.existsSync(mappingPath)) {
            throw new Error(`Mapping registry not found at ${mappingPath}`);
        }
        const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        const { engineering_map, mcc_map } = mapping;

        const stats = {
            engineering_cutoffs: { matched: 0, stamped: 0, skipped: 0, conflicts: 0, total: 0 },
            seat_matrix: { matched: 0, stamped: 0, skipped: 0, conflicts: 0, total: 0 },
            medical_seat_matrix: { matched: 0, stamped: 0, skipped: 0, conflicts: 0, total: 0 }
        };

        // --- Helper: Update Collection deterministicly ---
        async function updateCollection({ name, findQuery, getTargetId, idField = 'institution_id' }) {
            const collection = db.collection(name);
            const cursor = collection.find(findQuery);
            const total = await collection.countDocuments(findQuery);
            stats[name].total = total;

            console.log(`Processing ${name} (${total} candidate records)...`);

            let processed = 0;
            while (await cursor.hasNext()) {
                const doc = await cursor.next();
                processed++;
                if (processed % 1000 === 0) process.stdout.write('.');

                const targetId = getTargetId(doc);
                if (!targetId) continue;

                stats[name].matched++;

                const existingId = doc[idField];
                if (existingId) {
                    if (existingId === targetId) {
                        stats[name].skipped++;
                        continue;
                    } else if (!FORCE_RECODE) {
                        stats[name].conflicts++;
                        if (stats[name].conflicts < 10) {
                            console.warn(`\n[CONFLICT] ID mismatch in ${name} for doc ${doc._id}: Found ${existingId}, Expected ${targetId}`);
                        }
                        continue;
                    } else {
                        // FORCE_RECODE is true
                        stats[name].stamped++;
                    }
                } else {
                    stats[name].stamped++;
                }

                if (!DRY_RUN) {
                    await collection.updateOne(
                        { _id: doc._id },
                        { $set: { [idField]: targetId } }
                    );
                }
            }
            console.log('\n');
        }

        // 2. Bridge Engineering Cutoffs
        // We match by institute_name_raw exactly against our engineering_map
        await updateCollection({
            name: 'engineering_cutoffs',
            findQuery: { institute_name_raw: { $in: Object.keys(engineering_map) } },
            getTargetId: (doc) => engineering_map[doc.institute_name_raw]
        });

        // 3. Bridge Seat Matrix
        await updateCollection({
            name: 'seat_matrix',
            findQuery: { institute_name_raw: { $in: Object.keys(engineering_map) } },
            getTargetId: (doc) => engineering_map[doc.institute_name_raw]
        });

        // 4. Bridge Medical Seat Matrix (The Priority Gap)
        await updateCollection({
            name: 'medical_seat_matrix',
            findQuery: { mcc_id: { $in: Object.keys(mcc_map) } },
            getTargetId: (doc) => mcc_map[doc.mcc_id]
        });

        // 5. Final Report
        console.log('\n--- Bridge Execution Summary ---');
        console.table(stats);

        if (Object.values(stats).some(s => s.conflicts > 0)) {
            console.error('\n🚨 FATAL: Conflicts detected. Check potential bad mappings.');
            if (!DRY_RUN) process.exit(1);
        }

        if (DRY_RUN) {
            console.log('\n💡 This was a DRY RUN. No changes were committed to the database.');
            console.log('To execute the real update, run: DRY_RUN=false node backend/scripts/truth_bridge_batch1.js');
        } else {
            console.log('\n✅ SUCCESS: Database has been stamped with deterministic CORE identifiers.');
        }

        process.exit(0);
    } catch (err) {
        console.error('\n❌ CRITICAL FAILURE:', err);
        process.exit(1);
    }
}

bridgeTruth();
