/**
 * backend/scripts/build_josaa_mappings.js
 * =======================================
 * Creates the josaa_mappings layer by linking josaa_code to institution_id.
 * UPDATED: Implements 3-layer Mapping Confidence Model.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const REGISTRY_PATH = path.join(__dirname, '..', 'data', 'truth', 'identity_registry.json');

async function buildMappings() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        const mappingsColl = db.collection('josaa_mappings');
        const institutesColl = db.collection('josaa_institutes');

        // Drop and recreate
        console.log('Dropping existing josaa_mappings...');
        try { await mappingsColl.drop(); } catch (e) {}
        await mappingsColl.createIndex({ josaa_code: 1 }, { unique: true });
        await mappingsColl.createIndex({ institution_id: 1 });

        console.log('Loading Identity Registry...');
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        
        // Build reverse indexes
        const nameToId = new Map();
        const normToId = new Map();
        const aliasToId = new Map();

        Object.entries(registry).forEach(([id, meta]) => {
            const canonicalLower = meta.canonical_name.toLowerCase();
            const canonicalNorm = canonicalLower.replace(/[^a-z0-9]/g, '');
            
            nameToId.set(canonicalLower, id);
            normToId.set(canonicalNorm, id);

            if (meta.aliases) {
                meta.aliases.forEach(alias => {
                    const aliasLower = alias.toLowerCase();
                    const aliasNorm = aliasLower.replace(/[^a-z0-9]/g, '');
                    aliasToId.set(aliasLower, id);
                    // Also store in norm index for robustness
                    if (!normToId.has(aliasNorm)) normToId.set(aliasNorm, id);
                });
            }
        });

        const josaaInstitutes = await institutesColl.find({}).toArray();
        console.log(`Processing ${josaaInstitutes.length} JoSAA institutes for mapping...`);

        const mappingDocs = [];
        let highCount = 0;
        let mediumCount = 0;
        let lowCount = 0;

        for (const inst of josaaInstitutes) {
            const rawName = inst.institute_name_raw;
            const lowerName = rawName.toLowerCase();
            const normalizedName = lowerName.replace(/[^a-z0-9]/g, '');

            let institution_id = 'UNMAPPED';
            let match_type = 'none';
            let confidence = 'low';
            let verified = false;

            // TIER 1: EXACT NAME MATCH (High Confidence)
            if (nameToId.has(lowerName)) {
                institution_id = nameToId.get(lowerName);
                match_type = 'exact_name';
                confidence = 'high';
                verified = true;
                highCount++;
            } 
            // TIER 1: ALIAS REGISTRY MATCH (High Confidence)
            else if (aliasToId.has(lowerName)) {
                institution_id = aliasToId.get(lowerName);
                match_type = 'alias_registry';
                confidence = 'high';
                verified = true;
                highCount++;
            }
            // TIER 2: NORMALIZED EXACT MATCH (Medium Confidence)
            else if (normToId.has(normalizedName)) {
                institution_id = normToId.get(normalizedName);
                match_type = 'normalized_exact';
                confidence = 'medium';
                verified = false; // NOT verified due to spelling/punctuation differences
                mediumCount++;
            } else {
                lowCount++;
            }

            mappingDocs.push({
                josaa_code: inst.josaa_code,
                institution_id,
                institute_name_raw: rawName,
                match_type,
                confidence,
                verified,
                mapped_at: new Date()
            });
        }

        await mappingsColl.insertMany(mappingDocs);
        console.log(`\n✅ Mapping Complete:
- TIER 1 (High):   ${highCount}
- TIER 2 (Medium): ${mediumCount}
- TIER 3 (Low):    ${lowCount}
- Total:           ${mappingDocs.length}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

buildMappings();
