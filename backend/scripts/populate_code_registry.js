/**
 * backend/scripts/populate_code_registry.js
 * =========================================
 * Populates official_code_registry.json from existing MongoDB data.
 * Captures AICTE, AISHE, JoSAA, and NIRF mappings.
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const REGISTRY_PATH = path.join(__dirname, '..', 'data', 'truth', 'official_code_registry.json');
const CONFLICT_PATH = path.join(__dirname, '..', 'data', 'truth', 'official_code_registry_conflicts.json');

const identityEnforcement = require('../lib/identityEnforcement');

async function populateRegistry() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        const registry = { josaa: {}, aicte: {}, aishe: {}, nirf: {} };
        const conflicts = { josaa: {}, aicte: {}, aishe: {}, nirf: {} };

        // 1. Process Institutions (AICTE & AISHE)
        console.log('Processing Institutions (AICTE/AISHE)...');
        const institutions = await db.collection('institutions').find({
            institution_id: { $exists: true }
        }).toArray();

        institutions.forEach(inst => {
            const id = inst.institution_id;
            const aicte = inst.aicte_id;
            const aishe = inst.aishe_code || inst.aisheId;
            const josaa = inst.josaa_code || inst.josaaId;

            if (aicte) {
                if (registry.aicte[aicte] && registry.aicte[aicte] !== id) {
                    conflicts.aicte[aicte] = [registry.aicte[aicte], id];
                } else {
                    registry.aicte[aicte] = id;
                }
            }

            if (aishe) {
                if (registry.aishe[aishe] && registry.aishe[aishe] !== id) {
                    conflicts.aishe[aishe] = [registry.aishe[aishe], id];
                } else {
                    registry.aishe[aishe] = id;
                }
            }

            if (josaa) {
                if (registry.josaa[josaa] && registry.josaa[josaa] !== id) {
                    conflicts.josaa[josaa] = [registry.josaa[josaa], id];
                } else {
                    registry.josaa[josaa] = id;
                }
            }
        });

        // 2. Process Engineering Cutoffs (JoSAA)
        console.log('Processing Cutoffs (JoSAA)...');
        const cutoffs = await db.collection('engineering_cutoffs').find({
            source_authority: { $in: ['JOSAA', 'CSAB', 'JoSAA', 'csab'] },
            institution_id: { $exists: true }
        }).toArray();

        for (const c of cutoffs) {
            let id = c.institution_id;
            // Resolve name-based ID if necessary
            if (!id.startsWith('CORE-') && !id.startsWith('S-')) {
                const resolved = identityEnforcement.resolveCanonicalId(id);
                if (resolved && resolved.startsWith('CORE-')) {
                    id = resolved;
                } else {
                    continue; // Skip unresolvable name-based IDs
                }
            }

            const code = c.josaa_code || c.institute_code || c.code;
            if (code) {
                if (registry.josaa[code] && registry.josaa[code] !== id) {
                    conflicts.josaa[code] = [registry.josaa[code], id];
                } else {
                    registry.josaa[code] = id;
                }
            }
        }

        // 3. Process Rankings (NIRF)
        console.log('Processing Rankings (NIRF)...');
        const rankings = await db.collection('rankings').find({
            institution_id: { $exists: true }
        }).toArray();

        rankings.forEach(r => {
            const id = r.institution_id;
            // NIRF ID is often in raw_data.institution_id
            const nirf = r.nirf_id || (r.raw_data && r.raw_data.institution_id);
            if (nirf && nirf !== id) { // Ensure nirf is the IR- code, not the internal ID
                if (registry.nirf[nirf] && registry.nirf[nirf] !== id) {
                    conflicts.nirf[nirf] = [registry.nirf[nirf], id];
                } else {
                    registry.nirf[nirf] = id;
                }
            }
        });

        // Write Registry
        fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
        fs.writeFileSync(CONFLICT_PATH, JSON.stringify(conflicts, null, 2));

        // Stats
        console.log('\n--- POPULATION COMPLETE ---');
        console.log(`AICTE Mappings: ${Object.keys(registry.aicte).length}`);
        console.log(`AISHE Mappings: ${Object.keys(registry.aishe).length}`);
        console.log(`JoSAA Mappings: ${Object.keys(registry.josaa).length}`);
        console.log(`NIRF  Mappings: ${Object.keys(registry.nirf).length}`);
        console.log(`\nConflicts: ${Object.keys(conflicts.aicte).length + Object.keys(conflicts.aishe).length + Object.keys(conflicts.josaa).length}`);

        // Sample Validation
        console.log('\n--- SAMPLE VALIDATION ---');
        ['CORE-IIT-BOMBAY', 'CORE-NIT-TRICHY', 'CORE-IIIT-ALLAHABAD'].forEach(sample => {
            const josaaMatch = Object.entries(registry.josaa).find(([code, id]) => id === sample);
            console.log(`${sample}: ${josaaMatch ? `✅ JoSAA Found (${josaaMatch[0]})` : '❌ JoSAA Missing'}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

populateRegistry();
