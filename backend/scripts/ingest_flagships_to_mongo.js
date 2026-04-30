const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: 'backend/.env.local' });

// Precision Data Matrix
const CORE_DATA_MATRIX = {
  "Indian Institute of Technology Madras": { id: "CORE-IIT-MADRAS", stableKey: "iit-madras" },
  "Indian Institute of Technology Delhi": { id: "CORE-IIT-DELHI", stableKey: "iit-delhi" },
  "Indian Institute of Technology Bombay": { id: "CORE-IIT-BOMBAY", stableKey: "iit-bombay" },
  "Indian Institute of Technology Kanpur": { id: "CORE-IIT-KANPUR", stableKey: "iit-kanpur" },
  "Indian Institute of Technology Roorkee": { id: "CORE-IIT-ROORKEE", stableKey: "iit-roorkee" },
  "Indian Institute of Technology Kharagpur": { id: "CORE-IIT-KHARAGPUR", stableKey: "iit-kharagpur" },
  "Indian Institute of Technology Guwahati": { id: "CORE-IIT-GUWAHATI", stableKey: "iit-guwahati" },
  "Indian Institute of Technology Hyderabad": { id: "CORE-IIT-HYDERABAD", stableKey: "iit-hyderabad" },
  "Indian Institute of Management Ahmedabad": { id: "CORE-IIM-AHMEDABAD", stableKey: "iim-ahmedabad" },
  "Indian Institute of Management Bangalore": { id: "CORE-IIM-BANGALORE", stableKey: "iim-bangalore" },
  "Indian Institute of Management Calcutta": { id: "CORE-IIM-CALCUTTA", stableKey: "iim-calcutta" },
  "All India Institute of Medical Sciences Delhi": { id: "CORE-AIIMS-DELHI", stableKey: "aiims-delhi" },
  "BITS Pilani": { id: "CORE-BITS-PILANI", stableKey: "bits-pilani" },
  "NIT Trichy": { id: "CORE-NIT-TRICHY", stableKey: "nit-trichy" },
  "NIT Surathkal": { id: "CORE-NIT-SURATHKAL", stableKey: "nit-surathkal" },
  "NIT Warangal": { id: "CORE-NIT-WARANGAL", stableKey: "nit-warangal" }
};

function getSlug(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

const identityEnforcement = require('../lib/identityEnforcement');

async function runIngest() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        const institutions = db.collection('institutions');

        const bulkOps = [];
        const processedIds = new Set();
        const violations = db.collection('identity_violations');

        // 1. Process Metadata Truth (High Priority)
        const metadataPath = path.join(__dirname, '..', 'data', 'truth', 'core_metadata_v2.ndjson');
        if (fs.existsSync(metadataPath)) {
            const metadataRaw = fs.readFileSync(metadataPath, 'utf8').split('\n').filter(l => l.trim());
            console.log(`Processing ${metadataRaw.length} core metadata records...`);
            for (const line of metadataRaw) {
                const data = JSON.parse(line);
                const name = data.name;
                
                // --- IDENTITY AUTHORITY HOOK (Quarantine Enabled) ---
                // Pre-lookup for scoring context
                const existingViolation = await violations.findOne({ normalized_name: identityEnforcement.normalize(name), state: data.state });
                const frequency = (existingViolation?.frequency || 0) + 1;
                
                const validation = identityEnforcement.validateForIngestion({ 
                    ...data, 
                    frequency, 
                    first_seen: existingViolation?.first_seen || new Date() 
                });
                
                if (!validation.canInsert) {
                    if (validation.status === 'quarantine') {
                        console.warn(`[Quarantine] Capturing unregistered CORE asset: ${name} (Score: ${validation.approvalScore})`);
                        await violations.updateOne(
                            { normalized_name: validation.metadata.normalized_name, state: validation.metadata.state },
                            { 
                                $set: validation.metadata, 
                                $addToSet: { source_types: data.source || 'unverified' },
                                $inc: { frequency: 1 } 
                            },
                            { upsert: true }
                        );
                    } else {
                        console.error(`[IngestHook] Skipping ${name}: ${validation.reason}`);
                    }
                    continue;
                }
                const targetId = validation.resolvedId;
                
                processedIds.add(targetId);
                bulkOps.push({
                    updateOne: {
                        filter: { $or: [{ id: targetId }, { institution_name: name }] },
                        update: { $set: { 
                            ...data, 
                            id: targetId, 
                            institution_name: name,
                            stable_import_key: `SECURED-${targetId}`,
                            isCore: true, 
                            isPremium: true, 
                            lastUpdated: new Date() 
                        } },
                        upsert: true
                    }
                });
            }
        }

        // 2. Scan colleges_new.ndjson for heuristic flagships
        const collegesPath = path.join(__dirname, '..', 'data', 'colleges_new.ndjson');
        if (fs.existsSync(collegesPath)) {
            console.log('Scanning colleges_new.ndjson for more flagships...');
            const collegesRaw = fs.readFileSync(collegesPath, 'utf8').split('\n').filter(l => l.trim());
            
            for (const line of collegesRaw) {
                const c = JSON.parse(line);
                const name = c.name || "";
                
                // --- IDENTITY AUTHORITY HOOK (Quarantine Enabled) ---
                const validation = identityEnforcement.validateForIngestion(c);
                if (!validation.canInsert) {
                    if (validation.status === 'quarantine') {
                         await violations.updateOne(
                            { normalized_name: validation.metadata.normalized_name, state: validation.metadata.state },
                            { $set: validation.metadata, $inc: { frequency: 1 } },
                            { upsert: true }
                        );
                    }
                    continue;
                }
                const coreId = validation.resolvedId;
                if (!coreId.startsWith('CORE-')) continue;
                
                if (processedIds.has(coreId)) continue;
                processedIds.add(coreId);

                bulkOps.push({
                    updateOne: {
                        filter: { $or: [{ id: coreId }, { institution_name: name }] },
                        update: { $set: { 
                            ...c, 
                            id: coreId, 
                            institution_name: name,
                            stable_import_key: `SECURED-${coreId}`,
                            isCore: true, 
                            isPremium: true, 
                            lastUpdated: new Date() 
                        } },
                        upsert: true
                    }
                });
            }
        }

        if (bulkOps.length > 0) {
            console.log(`Executing bulk write for ${bulkOps.length} CORE institutions...`);
            const result = await institutions.bulkWrite(bulkOps, { ordered: false });
            console.log(`✅ Success: ${result.upsertedCount + result.modifiedCount} CORE institutions are now PERSISTENT.`);
        }

        // Verification
        const iitCount = await institutions.countDocuments({ institution_name: /Indian Institute of Technology/i });
        const nitCount = await institutions.countDocuments({ institution_name: /National Institute of Technology/i });
        console.log(`--- Verification ---`);
        console.log(`Persistent IITs: ${iitCount}`);
        console.log(`Persistent NITs: ${nitCount}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

runIngest();
