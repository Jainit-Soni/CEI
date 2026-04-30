/**
 * generate_identity_registry.js
 *
 * Populates identity_registry.json with canonical short-form IDs.
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Import enforcement for ID resolution
const identityEnforcement = require('../lib/identityEnforcement');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;

    console.log('Fetching institutions...');
    const institutions = await db.collection('institutions').find({
        institution_id: { $regex: /^CORE-/ }
    }).toArray();

    const registry = {};

    institutions.forEach(inst => {
        const name = inst.name || inst.institution_name || inst.canonical_name;
        if (!name) return;

        // Use the enforcement layer to resolve the BEST canonical ID
        const canonicalId = identityEnforcement.resolveCanonicalId(name);
        
        if (!registry[canonicalId]) {
            registry[canonicalId] = {
                canonical_name: name,
                aliases: inst.aliases || [],
                state: inst.state
            };
        } else {
            // Add as alias if different from canonical name
            if (name !== registry[canonicalId].canonical_name) {
                if (!registry[canonicalId].aliases.includes(name)) {
                    registry[canonicalId].aliases.push(name);
                }
            }
        }
    });

    const outputPath = path.join(__dirname, '../data/truth/identity_registry.json');
    fs.writeFileSync(outputPath, JSON.stringify(registry, null, 2));

    console.log(`Registry re-generated with ${Object.keys(registry).length} canonical entries at ${outputPath}`);
    process.exit(0);
}

run().catch(console.error);
