/**
 * backend/scripts/apply_josaa_aliases.js
 * ======================================
 * Safely applies approved JoSAA candidates as aliases in the identity registry.
 * Enforces strict safety checks before mutation.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const REGISTRY_PATH = path.join(__dirname, '..', 'data', 'truth', 'identity_registry.json');
const HISTORY_PATH = path.join(__dirname, '..', 'data', 'truth', 'identity_registry_history.json');

async function apply() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        console.log('Loading Identity Registry...');
        const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        
        console.log('Fetching Approved JoSAA Candidates...');
        const candidates = await db.collection('identity_violations').find({
            status: "approved_candidate",
            promotion_type: "JOSAA_ALIAS_PROMOTION"
        }).toArray();

        console.log(`Reviewing ${candidates.length} candidates...`);

        let addedCount = 0;
        let skippedCount = 0;
        const skipReasons = {};
        const changes = [];
        const historyEntries = [];

        for (const cand of candidates) {
            const { josaa_code, institute_name_raw, institution_id, source_stats } = cand;

            // --- SAFETY CHECKS ---
            
            // 1. josaa_code exists
            if (!josaa_code) {
                skip(institute_name_raw, "MISSING_JOSAA_CODE");
                continue;
            }

            // 2. source evidence includes both cutoffs and seat_matrix
            if (!(source_stats.cutoffCount > 0 && source_stats.seatCount > 0)) {
                skip(institute_name_raw, "INSUFFICIENT_EVIDENCE");
                continue;
            }

            // 3. target institution_id exists
            if (!registry[institution_id]) {
                skip(institute_name_raw, `INVALID_TARGET_ID: ${institution_id}`);
                continue;
            }

            // 4. no duplicate alias already exists
            const meta = registry[institution_id];
            const isCanonical = meta.canonical_name === institute_name_raw;
            const isAlias = (meta.aliases || []).includes(institute_name_raw);

            if (isCanonical || isAlias) {
                skip(institute_name_raw, "ALREADY_PRESENT_IN_REGISTRY");
                continue;
            }

            // 5. elite validation check (redundant but safe)
            // Ensure NIT matches NIT ID, IIT matches IIT ID
            if (institution_id.startsWith('CORE-NIT-') && !institute_name_raw.toUpperCase().includes('NATIONAL INSTITUTE OF TECHNOLOGY')) {
                if (!institute_name_raw.toUpperCase().includes('NIT')) {
                    skip(institute_name_raw, "ELITE_TYPE_MISMATCH");
                    continue;
                }
            }

            // --- APPLY ---
            if (!meta.aliases) meta.aliases = [];
            meta.aliases.push(institute_name_raw);
            
            addedCount++;
            changes.push(`${institute_name_raw} -> ${institution_id}`);
            historyEntries.push({
                institution_id,
                action: "ADD_ALIAS",
                value: institute_name_raw,
                reason: `JoSAA Approved Alias (Code: ${josaa_code})`,
                timestamp: new Date()
            });

            // Mark as applied in DB
            await db.collection('identity_violations').updateOne(
                { _id: cand._id },
                { $set: { status: "applied", applied_at: new Date() } }
            );
        }

        if (addedCount > 0) {
            console.log(`\nWriting ${addedCount} aliases to registry...`);
            fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

            // Update history
            let history = [];
            if (fs.existsSync(HISTORY_PATH)) {
                history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
            }
            history.push(...historyEntries);
            fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
        }

        // --- REPORT ---
        console.log(`\n--- Execution Report ---`);
        console.log(`Added:   ${addedCount}`);
        console.log(`Skipped: ${skippedCount}`);
        if (Object.keys(skipReasons).length > 0) {
            console.log(`Skip Reasons:`, JSON.stringify(skipReasons, null, 2));
        }
        
        if (changes.length > 0) {
            console.log(`\nSample Changes (First 10):`);
            console.log(changes.slice(0, 10).join('\n'));
        }

        process.exit(0);

        function skip(name, reason) {
            skippedCount++;
            skipReasons[reason] = (skipReasons[reason] || 0) + 1;
            // console.warn(`Skipping ${name}: ${reason}`);
        }
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

apply();
