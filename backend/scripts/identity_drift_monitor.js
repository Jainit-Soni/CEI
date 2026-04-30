/**
 * backend/scripts/identity_drift_monitor.js
 * ========================================
 * Daily job to detect identity inconsistencies and silent drift.
 * 1. Scans for duplicate institutions across states.
 * 2. Validates that HIGH-confidence institutions have zero ID collisions.
 * 3. Reports conflicting official codes.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const CODES_PATH = path.join(__dirname, '..', 'data', 'truth', 'official_code_registry.json');
const REPORT_PATH = path.join(__dirname, '..', 'data', 'truth', 'identity_drift_report.json');
const UPGRADE_PATH = path.join(__dirname, '..', 'data', 'truth', 'identity_upgrades.json');

async function monitorDrift() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        console.log('Loading Official Code Registry...');
        const officialCodes = JSON.parse(fs.readFileSync(CODES_PATH, 'utf8'));
        
        // Reverse maps: Code -> Canonical ID
        const josaaRev = officialCodes.josaa || {};
        const aicteRev = officialCodes.aicte || {};
        const aisheRev = officialCodes.aishe || {};

        console.log('Fetching all institutions...');
        const colleges = await db.collection('institutions').find({}, { 
            projection: { id: 1, institution_id: 1, name: 1, state: 1, city: 1, josaa_code: 1, aicte_id: 1, aishe_code: 1 } 
        }).toArray();

        const drift = {
            code_mismatches: [],
            state_name_collisions: [],
            unregistered_high_confidence: [],
            upgrades_available: [],
            confidence_decay: [],
            timestamp: new Date()
        };

        const nameStateMap = new Map(); // "normName|state" -> [ids]
        const codeToIdMap = new Map(); // "type|code" -> id

        for (const col of colleges) {
            const cid = col.institution_id || col.id;
            const normName = (col.name || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            const state = (col.state || "").toLowerCase();
            const key = `${normName}|${state}`;

            // 1. Detect Name+State Collisions
            if (normName && state) {
                if (!nameStateMap.has(key)) nameStateMap.set(key, []);
                nameStateMap.get(key).push(cid);
            }

            // 2. Detect Code Mismatches
            const codes = [
                { val: col.josaa_code, type: 'josaa', registry: josaaRev },
                { val: col.aicte_id, type: 'aicte', registry: aicteRev },
                { val: col.aishe_code, type: 'aishe', registry: aisheRev }
            ];

            const isElite = (cid.startsWith('CORE-IIT-') || cid.startsWith('CORE-NIT-') || cid.startsWith('CORE-IIIT-'));

            for (const c of codes) {
                if (c.val) {
                    const registryId = c.registry[c.val];
                    
                    // If the DB has a code, but the registry maps that code to a DIFFERENT ID
                    if (registryId && registryId !== cid) {
                        drift.code_mismatches.push({
                            severity: isElite ? 'HIGH' : 'MEDIUM',
                            institution_id: cid,
                            name: col.name,
                            code_type: c.type,
                            code_value: c.val,
                            db_id: cid,
                            registry_id: registryId
                        });
                    }

                    // Detect multiple institutions sharing the SAME code in DB
                    const codeKey = `${c.type}|${c.val}`;
                    if (codeToIdMap.has(codeKey) && codeToIdMap.get(codeKey) !== cid) {
                        drift.code_mismatches.push({
                            severity: 'HIGH',
                            type: "DUPLICATE_CODE_USAGE_IN_DB",
                            code: codeKey,
                            id1: codeToIdMap.get(codeKey),
                            id2: cid
                        });
                    }
                    codeToIdMap.set(codeKey, cid);

                    // 3. Detect MEDIUM -> HIGH Upgrades
                    // If the institution is NOT in registry (or is MEDIUM/CORE- only) 
                    // but we found a valid code in the DB.
                    const isRegistered = !!officialCodes.josaa[c.val] || !!officialCodes.aicte[c.val] || !!officialCodes.aishe[c.val];
                    if (!isRegistered && c.val) {
                         drift.upgrades_available.push({
                             institution_id: cid,
                             name: col.name,
                             code_type: c.type,
                             code_value: c.val,
                             reason: "Official Code Discovered in DB"
                         });
                    }
                }
            }

            // 4. Detect Confidence Decay (HIGH losing its code)
            if (cid.startsWith('CORE-')) {
                const hasRegistryCode = !!officialCodes.josaa[cid] || !!officialCodes.aicte[cid] || !!officialCodes.aishe[cid];
                const hasDbCode = col.josaa_code || col.aicte_id || col.aishe_code;
                
                if (hasRegistryCode && !hasDbCode) {
                    drift.confidence_decay.push({
                        severity: 'MEDIUM',
                        institution_id: cid,
                        name: col.name,
                        reason: "Registry code missing from DB (Potential metadata loss)"
                    });
                }
            }
        }

        // Finalize Name+State Collisions
        const genericPatterns = ['polytechnic', 'institute', 'college', 'school', 'academy'];
        for (const [key, ids] of nameStateMap.entries()) {
            if (ids.length > 1) {
                const uniqueIds = Array.from(new Set(ids));
                if (uniqueIds.length > 1) {
                    const [normName] = key.split('|');
                    const isGeneric = genericPatterns.some(p => normName.includes(p));

                    drift.state_name_collisions.push({
                        severity: isGeneric ? 'LOW' : 'MEDIUM',
                        key,
                        ids: uniqueIds
                    });
                }
            }
        }

        console.log(`\n--- Drift Monitoring Complete ---`);
        console.log(`Code Mismatches:      ${drift.code_mismatches.length}`);
        console.log(`State/Name Collisions: ${drift.state_name_collisions.length}`);
        console.log(`Potential Upgrades:    ${drift.upgrades_available.length}`);

        fs.writeFileSync(REPORT_PATH, JSON.stringify(drift, null, 2));
        fs.writeFileSync(UPGRADE_PATH, JSON.stringify(drift.upgrades_available, null, 2));
        console.log(`Reports written to: ${REPORT_PATH}, ${UPGRADE_PATH}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

monitorDrift();
