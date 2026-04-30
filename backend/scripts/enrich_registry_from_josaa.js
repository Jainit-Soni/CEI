/**
 * backend/scripts/enrich_registry_from_josaa.js
 * ============================================
 * Controlled Alias Enrichment.
 * Ingests JoSAA names as aliases for existing registry entries
 * ONLY when normalized exact matching confirms identity.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const REGISTRY_PATH = path.join(__dirname, '..', 'data', 'truth', 'identity_registry.json');
const HISTORY_PATH = path.join(__dirname, '..', 'data', 'truth', 'identity_registry_history.json');

async function enrich() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        console.log('Loading Identity Registry...');
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        
        // Build normalized index for canonical names
        const normToId = new Map();
        Object.entries(registry).forEach(([id, meta]) => {
            const norm = meta.canonical_name.toLowerCase().replace(/[^a-z0-9]/g, '');
            normToId.set(norm, id);
        });

        const josaaInstitutes = await db.collection('josaa_institutes').find({}).toArray();
        console.log(`Analyzing ${josaaInstitutes.length} JoSAA institutes for potential aliases...`);

        const newAliases = [];
        const historyEntries = [];

        for (const inst of josaaInstitutes) {
            const rawName = inst.institute_name_raw;
            const normName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');

            if (normToId.has(normName)) {
                const institution_id = normToId.get(normName);
                const meta = registry[institution_id];

                // If this raw name is not already the canonical name or an alias
                const isCanonical = meta.canonical_name === rawName;
                const isAlias = (meta.aliases || []).includes(rawName);

                if (!isCanonical && !isAlias) {
                    // Check if difference is "minor" (CEI-safe)
                    // Minor = only punctuation, spacing, or "(IIIT)" / "(BHU)" additions
                    const diff = rawName.replace(meta.canonical_name, '').replace(/[^A-Za-z]/g, '').toUpperCase();
                    const isMinor = diff === "" || ["IIIT", "BHU", "ISM"].includes(diff);

                    if (isMinor) {
                        console.log(`✨ Suggesting Alias: "${rawName}" -> ${institution_id} (${meta.canonical_name})`);
                        if (!meta.aliases) meta.aliases = [];
                        meta.aliases.push(rawName);
                        
                        newAliases.push({ institution_id, alias: rawName });
                        historyEntries.push({
                            institution_id,
                            action: "ADD_ALIAS",
                            value: rawName,
                            reason: "JoSAA Authoritative Variant (Normalized Match)",
                            timestamp: new Date()
                        });
                    }
                }
            }
        }

        if (newAliases.length > 0) {
            console.log(`\nWriting ${newAliases.length} new aliases to registry...`);
            fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

            // Update history
            let history = [];
            if (fs.existsSync(HISTORY_PATH)) {
                history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
            }
            history.push(...historyEntries);
            fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
            
            console.log('✅ Registry Enriched.');
        } else {
            console.log('No new aliases found to promote.');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

enrich();
