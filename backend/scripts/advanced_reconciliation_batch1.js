const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });
const fs = require('fs');
const path = require('path');

function slugify(text) {
    return String(text)
        .toLowerCase()
        .replace(/,/g, '')
        .replace(/-/g, ' ')
        .replace(/\(/g, '')
        .replace(/\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const FLAGSHIP_OVERRIDES = {
    'Indian Institute of Technology Madras': 'CORE-IIT-MADRAS',
    'Indian Institute of Technology Delhi': 'CORE-IIT-DELHI',
    'Indian Institute of Technology Bombay': 'CORE-IIT-BOMBAY',
    'Indian Institute of Technology Kanpur': 'CORE-IIT-KANPUR',
    'Indian Institute of Technology Kharagpur': 'CORE-IIT-KHARAGPUR',
    'Indian Institute of Technology Roorkee': 'CORE-IIT-ROORKEE',
    'Indian Institute of Technology Guwahati': 'CORE-IIT-GUWAHATI',
    'Indian Institute of Technology Hyderabad': 'CORE-IIT-HYDERABAD',
    'All India Institute of Medical Sciences Delhi': 'CORE-AIIMS-DELHI'
};

async function runAdvancedReconciliation() {
    try {
        console.log('--- CEI Advanced Identity Reconciliation [Batch 1] ---');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        // 1. Load Registry
        const registryPath = path.join(__dirname, '..', 'data', 'truth', 'core_id_mapping_batch1.json');
        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

        // 2. Index Institutions
        const institutions = await db.collection('institutions').find({}).toArray();
        const mongoSlugMap = {};
        institutions.forEach(i => {
           mongoSlugMap[slugify(i.name)] = i.id;
        });

        const reconciliation = {
            metadata: {
                timestamp: new Date().toISOString(),
                rule: 'SLUG_MATCH_WITH_FLAGSHIP_OVERRIDE'
            },
            reconciliation_set: []
        };

        const stats = {
            verified_match: 0,
            remap_required: 0,
            flagship_override: 0,
            unresolved: 0
        };

        for (const [name, legacyId] of Object.entries(registry.engineering_map)) {
            const slug = slugify(name);
            let actualId = mongoSlugMap[slug];
            let basis = 'SLUG_MATCH';
            let status = 'UNRESOLVED';

            // Check Override first
            if (FLAGSHIP_OVERRIDES[name]) {
                actualId = FLAGSHIP_OVERRIDES[name];
                basis = 'EXPLICIT_FLAGSHIP_OVERRIDE';
                status = legacyId === actualId ? 'VERIFIED_MATCH' : 'REMAP_REQUIRED';
                stats.flagship_override++;
            } else if (actualId) {
                status = legacyId === actualId ? 'VERIFIED_MATCH' : 'REMAP_REQUIRED';
                basis = 'SLUG_MATCH';
            }

            if (status === 'VERIFIED_MATCH') stats.verified_match++;
            if (status === 'REMAP_REQUIRED') stats.remap_required++;
            if (status === 'UNRESOLVED') stats.unresolved++;

            reconciliation.reconciliation_set.push({
                canonical_name: name,
                legacy_id: legacyId,
                actual_id: actualId || null,
                status,
                reconciliation_basis: basis,
                reviewed: status === 'VERIFIED_MATCH' || basis === 'EXPLICIT_FLAGSHIP_OVERRIDE'
            });
        }

        console.log('\n--- ADVANCED RECONCILIATION SUMMARY ---');
        console.table(stats);

        const artifactPath = path.join(__dirname, '..', 'data', 'truth', 'identity_reconciliation_batch1.json');
        fs.writeFileSync(artifactPath, JSON.stringify(reconciliation, null, 2));
        console.log(`\n✅ Verified Reconciliation Crosswalk generated: ${artifactPath}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

runAdvancedReconciliation();
