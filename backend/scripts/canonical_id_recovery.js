/**
 * canonical_id_recovery.js — EMERGENCY RECOVERY SCRIPT
 *
 * Goal: Restore 13,218 institutions accidentally merged/deleted.
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const REPORT_FILE = path.join(__dirname, '../data/truth/duplicate_report.json');

async function run() {
    console.log('🚑 Starting EMERGENCY RECOVERY...');
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;

    const data = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
    
    // The report has the structure: [ { institutions: [ ... ] }, ... ]
    // We want to re-insert everything that was in the institutions list EXCEPT the one that was chosen as canonical.
    // Actually, to be safe, I'll just re-insert ALL of them and let the canonical one fail on unique ID if it exists.
    // Or even better: check if ID exists first.

    let totalToRestore = 0;
    let restored = 0;

    for (const group of data) {
        // In the catastrophic merge, we chose ONE canonical and deleted the rest.
        // The rest are in group.institutions.
        // Wait, the canonical was group.institutions[0] (sorted).
        // Let's just try to insert all except the one currently in DB.
        
        for (const inst of group.institutions) {
            totalToRestore++;
            
            // Remove the _id so Mongo generates a new one (or keep it if we want exact restoration)
            // Since we deleted them, we can use the same _id if we want.
            const originalId = inst._id;
            delete inst._id; 

            try {
                // Check if institution_id already exists
                const exists = await db.collection('institutions').findOne({ institution_id: inst.institution_id });
                if (!exists) {
                    await db.collection('institutions').insertOne(inst);
                    restored++;
                }
            } catch (e) {
                console.error(`Failed to restore ${inst.institution_id}: ${e.message}`);
            }
        }
    }

    console.log(`\n✅ RECOVERY COMPLETE`);
    console.log(`Total candidates: ${totalToRestore}`);
    console.log(`Successfully restored: ${restored}`);
    
    const finalCount = await db.collection('institutions').countDocuments({});
    console.log(`Final Database Count: ${finalCount}`);

    process.exit(0);
}

run().catch(console.error);
