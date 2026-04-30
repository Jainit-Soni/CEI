/**
 * scripts/production_cohort_ingest.js
 * ===================================
 * Final Production Load for the Verified CEI Cohort (19,747 Institutions).
 * 
 * Logic:
 * 1. Wipe 'colleges' collection.
 * 2. Load Identity Registry (Hardened Keys).
 * 3. Hydrate with Truth NDJSON (Rich Data).
 * 4. Apply Deterministic Navigation Fields.
 * 5. Execute Bulk Ingest.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');

const DATA_DIR = path.join(__dirname, '../data/truth');
const ID_REG_PATH = path.join(DATA_DIR, 'identity_registry.json');
const HYDRATED_PATH = path.join(DATA_DIR, 'hydrated_truth.ndjson');

async function ingest() {
    console.log("🚀 STARTING PRODUCTION COHORT INGESTION...");
    
    // 1. Connect to DB
    const envPath = path.join(__dirname, '../.env.local');
    require('dotenv').config({ path: envPath });
    
    let uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB || 'cei_v2';
    
    if (uri && !uri.includes(`/${dbName}`) && uri.endsWith('/')) {
        uri = `${uri}${dbName}`;
    } else if (uri && !uri.includes(`/${dbName}`) && !uri.includes('?')) {
        uri = `${uri}/${dbName}`;
    }
    
    console.log(`[DB] Connecting to URI: ${uri}`);
    await mongoose.connect(uri);
    console.log(`✅ Connected to MongoDB: ${mongoose.connection.name}`);


    // 2. Wipe Slate
    console.log("🧹 Wiping 'colleges' collection...");
    await College.deleteMany({});
    try {
        console.log("🧹 Dropping stale indexes...");
        await College.collection.dropIndexes();
    } catch (e) {
        console.log("⚠️  Index drop failed (likely collection is empty or no indexes):", e.message);
    }
    console.log("✅ Collection cleared and indexes dropped.");


    // 3. Load Identities
    console.log("📂 Loading Identity Registry...");
    const idReg = JSON.parse(fs.readFileSync(ID_REG_PATH, 'utf8'));
    const ids = Object.keys(idReg);
    console.log(`✅ Found ${ids.length.toLocaleString()} verified identities.`);

    // 4. Load Hydrated Truth
    console.log("📂 Loading Hydrated Truth...");
    const hydratedData = fs.readFileSync(HYDRATED_PATH, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line));
    
    const truthMap = new Map();
    hydratedData.forEach(item => {
        truthMap.set(item.institution_id, item);
    });
    console.log(`✅ Found ${truthMap.size.toLocaleString()} rich truth records.`);

    // 5. Preparation & Bulk Write
    const batchSize = 1000;
    let processed = 0;
    
    console.log("⚡ Processing and Syncing...");

    for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const ops = batchIds.map(id => {
            const inst = idReg[id];
            const truth = truthMap.get(id) || {};
            
            // Calculate Coverage Bucket Dynamically
            let coverageBucket = 'None';
            const hasCutoffs = truth.cutoffs && truth.cutoffs.length > 0;
            const hasSeats = truth.seats && truth.seats.length > 0;
            const hasFees = truth.fees && (truth.fees.totalFee || truth.fees.totalNumeric);
            const hasPlacements = truth.placements && (truth.placements.averagePackageNumeric || truth.placements.highestPackageNumeric);

            if (hasCutoffs && hasSeats) {
                coverageBucket = 'Rich';
            } else if (hasCutoffs || hasSeats || hasFees || hasPlacements) {
                coverageBucket = 'Partial';
            }

            const isJoSAA = id.startsWith('CORE-IIT') || 
                            id.startsWith('CORE-NIT') || 
                            id.startsWith('CORE-IIIT') ||
                            id.includes('INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY') ||
                            id.includes('INDIAN-INSTITUTE-OF-TECHNOLOGY');
            
            const rankingTier = isJoSAA ? 'Tier 1' : (inst.rankingTier || 'Standard');

            // ── CANONICAL AUTHORITY (Pure Source) ──────────────────────────
            const authority_canonical = isJoSAA ? 'JOSAA' : 'STATE';
            const authority_source = 'verified'; // Since it's from the hardened registry

            // Merge Identity + Truth
            const collegeDoc = {
                id: id,
                name: inst.canonical_name || inst.name || truth.name || id,
                state: inst.state || 'National',
                authority: isJoSAA ? 'JoSAA' : 'State', // Legacy compatibility
                authority_canonical,
                authority_source,
                rankingTier: rankingTier,
                identityConfidence: inst.identityConfidence || 'HIGH',

                isVisible: true,
                isCore: id.startsWith('CORE-'),
                
                // Hydrated Layers
                engineeringCutoffs: truth.cutoffs || [],
                seatMatrix: truth.seats || [],
                fees: truth.fees || null,
                placements: truth.placements || null,
                courses: truth.courses || [],
                lastCoverageSync: new Date(),
                coverage: { 
                    coverageBucket: coverageBucket,
                    hasCutoffs,
                    hasSeats,
                    hasFees,
                    hasPlacements
                },
                
                // Metadata
                meta: {
                    ingestedAt: new Date().toISOString(),
                    source: 'CEI_VERIFIED_REGISTRY',
                    isHydrated: truthMap.has(id)
                }
            };



            return {
                insertOne: { document: collegeDoc }
            };
        });

        await College.bulkWrite(ops);
        processed += batchIds.length;
        process.stdout.write(`\r📦 Progress: ${processed.toLocaleString()}/${ids.length.toLocaleString()} synced...`);
    }

    console.log(`\n\n🎉 INGESTION COMPLETE!`);
    console.log(`-------------------------------------------`);
    console.log(`Total Verified Institutions: ${processed.toLocaleString()}`);
    console.log(`Truth Saturation          : ${((truthMap.size / processed) * 100).toFixed(1)}%`);
    console.log(`-------------------------------------------`);

    await mongoose.connection.close();
    process.exit(0);
}

ingest().catch(err => {
    console.error("💥 Ingestion Failure:", err);
    process.exit(1);
});
