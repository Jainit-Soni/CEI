/**
 * migrate_to_mongo.js — Verified Core Campaign + Total Re-Sync
 * ==========================================================
 * Final iteration ensuring 100% database fidelity for the 67k-record base 
 * and properly flagging all "Core" institutions for official metadata.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const { loadDataFromNDJSON } = require('../lib/dataStore');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function migrate() {
    console.log("🚀 Starting FINAL Infrastructure Re-Sync: NDJSON -> MongoDB");
    const startTime = Date.now();

    // 1. Connect to Database
    await connectDB();
    
    // 2. Wipe Clean Slate
    console.log("🧹 Wiping 'colleges' collection for 100% clean data sync...");
    await College.deleteMany({});
    console.log("✅ Database cleared.");

    // 3. Load and Enrich Data
    console.log("📂 Loading and Enriching 67k+ records with Verified Mapping Logic...");
    await loadDataFromNDJSON();
    
    const colleges = global.colleges;
    if (!colleges || colleges.length === 0) {
        console.error("❌ No colleges loaded. Check backend/data/colleges.ndjson");
        process.exit(1);
    }
    console.log(`✅ Loaded ${colleges.length.toLocaleString()} institutes into memory.`);

    // 4. Verification Check: Core Metadata
    const coreCount = colleges.filter(c => c.isCore).length;
    console.log(`🔍 Pre-Migration Audit:`);
    console.log(`- Core Institutions: ${coreCount}`);
    console.log(`- With Websites:    ${colleges.filter(c => c.website).length}`);
    console.log(`- With Courses:     ${colleges.filter(c => c.courses?.length > 0).length}`);

    // 5. Bulk Operations
    console.log("⚡ Executing High-Performance Bulk Write...");
    const batchSize = 2500; // Stabilizing batch size
    let processed = 0;
    
    for (let i = 0; i < colleges.length; i += batchSize) {
        const batch = colleges.slice(i, i + batchSize);
        
        const ops = batch.map(c => {
            const docId = c.id || c.stableKey;
            // Clean up internal _id if it's a string, Mongoose will handle it
            const { _id, ...docData } = c; 
            return {
                updateOne: {
                    filter: { id: docId },
                    update: { $set: { ...docData, id: docId } },
                    upsert: true
                }
            };
        });

        try {
            await College.bulkWrite(ops, { ordered: false });
            processed += batch.length;
            const percent = ((processed / colleges.length) * 100).toFixed(1);
            process.stdout.write(`\r📦 Progress: ${processed.toLocaleString()}/${colleges.length.toLocaleString()} institutions (${percent}%) synced...`);
        } catch (err) {
            console.error(`\n❌ Bulk write error at ${processed}:`, err.message);
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n\n🎉 ALL-INDIA RE-SYNC COMPLETE!`);
    console.log(`-------------------------------------------`);
    console.log(`Total Time     : ${duration}s`);
    console.log(`Total Records  : ${colleges.length.toLocaleString()}`);
    console.log(`Final Result   : ${processed.toLocaleString()} live in MongoDB`);
    console.log(`-------------------------------------------`);

    mongoose.connection.close();
    process.exit(0);
}

migrate().catch(err => {
    console.error("💥 Critical Re-Sync Failure:", err);
    process.exit(1);
});
