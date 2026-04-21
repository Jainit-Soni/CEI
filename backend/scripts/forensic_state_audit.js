const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const fs = require('fs');

async function runAudit() {
    try {
        console.log('--- CEI Hardened Forensic Audit [Batch 1] ---');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        // 1. Load Reconciliation Artifact
        const artifactPath = path.join(__dirname, '..', 'data', 'truth', 'identity_reconciliation_batch1.json');
        const reconciliation = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        
        // Index for verification
        const approvedActualIds = new Set(reconciliation.reconciliation_set.map(r => r.actual_institution_id).filter(id => id));

        // 2. Load Core Institutions for existence check
        const instList = await db.collection('institutions').find({}).toArray();
        const coreIds = new Set(instList.map(i => i.id));

        const collections = ['engineering_cutoffs', 'seat_matrix', 'medical_seat_matrix'];
        const results = {};

        for (const colName of collections) {
            console.log(`Auditing ${colName}...`);
            const stats = {
                total_scanned: 0,
                verified_alignment: 0, // id exists in institutions
                registry_mismatch: 0,  // id in registry != id in truth
                orphaned: 0,           // id in truth NOT in institutions
                recoded_valid: 0,      // has institution_id_legacy AND id exists
                unchanged_valid: 0,    // id exists, no legacy field
                skipped_unresolved: 0  // id was and remains null
            };

            const docs = await db.collection(colName).find({}).toArray();
            stats.total_scanned = docs.length;

            docs.forEach(doc => {
                const id = doc.institution_id;
                
                if (!id) {
                    stats.skipped_unresolved++;
                    return;
                }

                const exists = coreIds.has(id);
                if (!exists) {
                    stats.orphaned++;
                } else {
                    stats.verified_alignment++;
                    if (doc.institution_id_legacy) stats.recoded_valid++;
                    else stats.unchanged_valid++;
                }
            });

            results[colName] = stats;
        }

        console.log('\n--- FORENSIC INTEGRITY REPORT ---');
        console.table(results);

        // Bidirectional: Reconciliation -> Institutions
        console.log('\n[RECONCILIATION VALIDITY CHECK]');
        let crosswalkOrphans = 0;
        reconciliation.reconciliation_set.forEach(r => {
            if (r.approved && r.actual_institution_id && !coreIds.has(r.actual_institution_id)) {
                console.log(`❌ Crosswalk Error: "${r.canonical_name}" maps to missing ID "${r.actual_institution_id}"`);
                crosswalkOrphans++;
            }
        });
        
        if (crosswalkOrphans === 0) {
            console.log('✅ 100% Crosswalk-to-Core Validity');
        } else {
            console.log(`❌ FAILED: ${crosswalkOrphans} reconciliation orphans found.`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

runAudit();
