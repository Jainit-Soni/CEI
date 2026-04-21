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

async function runIngest() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        const institutions = db.collection('institutions');

        const bulkOps = [];
        const processedIds = new Set();

        // 1. Process Metadata Truth (High Priority)
        const metadataPath = path.join(__dirname, '..', 'data', 'truth', 'core_metadata_v2.ndjson');
        if (fs.existsSync(metadataPath)) {
            const metadataRaw = fs.readFileSync(metadataPath, 'utf8').split('\n').filter(l => l.trim());
            console.log(`Processing ${metadataRaw.length} core metadata records...`);
            for (const line of metadataRaw) {
                const data = JSON.parse(line);
                const name = data.name;
                let identity = CORE_DATA_MATRIX[name] || { id: `CORE-${getSlug(name).toUpperCase()}`, stableKey: getSlug(name) };
                
                processedIds.add(identity.id);
                bulkOps.push({
                    updateOne: {
                        filter: { $or: [{ id: identity.id }, { stableKey: identity.stableKey }, { institution_name: name }] },
                        update: { $set: { 
                            ...data, 
                            id: identity.id, 
                            stableKey: identity.stableKey, 
                            institution_name: name,
                            stable_import_key: `SECURED-${identity.id}`,
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
            const coreRegex = /Indian Institute of Technology|National Institute of Technology|Indian Institute of Information Technology|AIIMS|All India Institute of Medical Sciences|BITS Pilani|IIM /i;
            
            for (const line of collegesRaw) {
                const c = JSON.parse(line);
                const name = c.name || "";
                if (coreRegex.test(name)) {
                    const slug = getSlug(name);
                    const coreId = `CORE-${slug.toUpperCase()}`;
                    
                    if (processedIds.has(coreId)) continue;
                    processedIds.add(coreId);

                    bulkOps.push({
                        updateOne: {
                            filter: { $or: [{ id: coreId }, { stableKey: slug }, { institution_name: name }] },
                            update: { $set: { 
                                ...c, 
                                id: coreId, 
                                stableKey: slug, 
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
