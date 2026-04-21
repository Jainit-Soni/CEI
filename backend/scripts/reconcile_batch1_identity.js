const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });
const fs = require('fs');
const path = require('path');

async function runReconciliation() {
    try {
        console.log('--- CEI Identity Reconciliation Audit [Batch 1] ---');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        // 1. Load Registry (The Legacy IDs)
        const registryPath = path.join(__dirname, '..', 'data', 'truth', 'core_id_mapping_batch1.json');
        if (!fs.existsSync(registryPath)) throw new Error('Registry not found');
        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

        // 2. Index Institutions (The Actual IDs)
        const institutions = await db.collection('institutions').find({}).toArray();
        const mongoNameMap = {}; // Name -> ID
        const mongoIdSet = new Set();
        
        institutions.forEach(i => {
            mongoNameMap[i.name] = i.id;
            mongoIdSet.add(i.id);
        });

        const reconciliation = {
            metadata: {
                timestamp: new Date().toISOString(),
                total_registry_names: Object.keys(registry.engineering_map).length
            },
            reconciliation_set: []
        };

        const stats = {
            exact_match: 0,
            remap_required: 0,
            missing_in_db: 0,
            conflicts: 0
        };

        // Process Engineering Map
        for (const [name, legacyId] of Object.entries(registry.engineering_map)) {
            const actualId = mongoNameMap[name];
            
            let status = 'MISSING';
            let basis = 'NAME_MATCH_FAILURE';

            if (actualId) {
                if (actualId === legacyId) {
                    status = 'EXACT_MATCH';
                    basis = 'CANONICAL_IDENTITY_CONFIRMED';
                    stats.exact_match++;
                } else {
                    status = 'REMAP_REQUIRED';
                    basis = 'NAME_MATCH_DIALECT_MISMATCH';
                    stats.remap_required++;
                }
            } else {
                stats.missing_in_db++;
            }

            reconciliation.reconciliation_set.push({
                canonical_name: name,
                legacy_id: legacyId,
                actual_id: actualId || null,
                status,
                reconciliation_basis: basis,
                reviewed: status === 'EXACT_MATCH'
            });
        }

        // --- Report Results ---
        console.log('\n--- RECONCILIATION SUMMARY ---');
        console.table(stats);

        const artifactPath = path.join(__dirname, '..', 'data', 'truth', 'identity_reconciliation_batch1.json');
        fs.writeFileSync(artifactPath, JSON.stringify(reconciliation, null, 2));
        console.log(`\n✅ Reconciliation artifact generated: ${artifactPath}`);
        
        // Final sanity check: How many high-impact flagships need remap?
        const flagships = ['IIT Bombay', 'IIT Madras', 'IIT Delhi', 'AIIMS Delhi'];
        console.log('\nTarget Flagship Status:');
        reconciliation.reconciliation_set
            .filter(r => flagships.some(f => r.canonical_name.includes(f)))
            .forEach(r => console.log(`- ${r.canonical_name}: ${r.status} (${r.legacy_id} -> ${r.actual_id})`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

runReconciliation();
