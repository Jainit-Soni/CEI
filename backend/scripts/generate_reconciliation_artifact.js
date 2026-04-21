const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const fs = require('fs');

function slugify(text) {
    return String(text)
        .toLowerCase()
        .replace(/,/g, '')
        .replace(/-/g, ' ')
        .replace(/\(/g, '')
        .replace(/\)/g, '')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const FLAGSHIP_OVERRIDES = {
    'Indian Institute of Technology Bombay': 'CORE-IIT-BOMBAY',
    'Indian Institute of Technology Madras': 'CORE-IIT-MADRAS',
    'Indian Institute of Technology Delhi': 'CORE-IIT-DELHI',
    'Indian Institute of Technology Kanpur': 'CORE-IIT-KANPUR',
    'Indian Institute of Technology Kharagpur': 'CORE-IIT-KHARAGPUR',
    'Indian Institute of Technology Roorkee': 'CORE-IIT-ROORKEE',
    'Indian Institute of Technology Guwahati': 'CORE-IIT-GUWAHATI',
    'Indian Institute of Technology Hyderabad': 'CORE-IIT-HYDERABAD',
    'All India Institute of Medical Sciences Delhi': 'CORE-ALL-INDIA-INSTITUTE-OF-MEDICAL-SCIENCES-NEW-DELHI',
    'All India Institute of Medical Sciences, New Delhi': 'CORE-ALL-INDIA-INSTITUTE-OF-MEDICAL-SCIENCES-NEW-DELHI'
};

async function generateArtifact() {
    try {
        console.log('--- CEI Reconciliation Artifact Generator [Batch 1] ---');
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

        const reconciliation_set = [];
        const stats = { engineering_processed: 0, medical_processed: 0, remap: 0, unresolved: 0 };

        // Process Engineering
        for (const [name, legacyId] of Object.entries(registry.engineering_map)) {
            const slug = slugify(name);
            let actualId = mongoSlugMap[slug] || FLAGSHIP_OVERRIDES[name];
            let basis = FLAGSHIP_OVERRIDES[name] ? 'EXPLICIT_FLAGSHIP_OVERRIDE' : 'SLUG_MATCH';

            if (actualId) {
                const status = (actualId === legacyId) ? 'EXACT_MATCH' : 'REMAP_REQUIRED';
                if (status === 'REMAP_REQUIRED') stats.remap++;

                reconciliation_set.push({
                    canonical_name: name,
                    legacy_institution_id: legacyId,
                    actual_institution_id: actualId,
                    status,
                    reconciliation_basis: basis,
                    approved: true
                });
            } else {
                stats.unresolved++;
                reconciliation_set.push({
                    canonical_name: name,
                    legacy_institution_id: legacyId,
                    actual_institution_id: null,
                    status: 'UNRESOLVED',
                    approved: false
                });
            }
            stats.engineering_processed++;
        }

        // Process Medical (Manual Verification only for AIIMS Delhi)
        for (const [mccId, legacyId] of Object.entries(registry.mcc_map)) {
            // Find AIIMS Delhi specifically
            const name = "All India Institute of Medical Sciences, New Delhi";
            const actualId = FLAGSHIP_OVERRIDES[name];

            if (legacyId.includes('DELHI')) {
                reconciliation_set.push({
                    canonical_name: name,
                    legacy_institution_id: legacyId,
                    actual_institution_id: actualId,
                    status: (actualId === legacyId) ? 'EXACT_MATCH' : 'REMAP_REQUIRED',
                    reconciliation_basis: 'EXPLICIT_MEDICAL_FLAGSHIP_OVERRIDE',
                    approved: true
                });
                stats.remap++;
            } else {
                reconciliation_set.push({
                    canonical_name: `MCC_ID_${mccId}`,
                    legacy_institution_id: legacyId,
                    actual_institution_id: null,
                    status: 'SKIPPED_MISSING_RAW_DATA',
                    approved: false
                });
            }
            stats.medical_processed++;
        }

        const output = {
            metadata: {
                timestamp: new Date().toISOString(),
                stats
            },
            reconciliation_set
        };

        const artifactPath = path.join(__dirname, '..', 'data', 'truth', 'identity_reconciliation_batch1.json');
        fs.writeFileSync(artifactPath, JSON.stringify(output, null, 2));

        console.log('\n--- ARTIFACT GENERATION SUMMARY ---');
        console.table(stats);
        console.log(`\n✅ Reconciliation artifact finalized: ${artifactPath}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

generateArtifact();
