const axios = require('axios');
const mongoose = require('mongoose');
const envPath = require('path').join(__dirname, '../.env.local');
require('dotenv').config({ path: envPath });
const College = require('../models/CollegeSchema');

async function runAudit() {
    let uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB || 'cei_v2';
    
    if (uri && !uri.includes(`/${dbName}`) && uri.endsWith('/')) {
        uri = `${uri}${dbName}`;
    } else if (uri && !uri.includes(`/${dbName}`) && !uri.includes('?')) {
        uri = `${uri}/${dbName}`;
    }

    await mongoose.connect(uri || 'mongodb://localhost:27017/cei_v2');
    console.log("Connected to MongoDB for sampling...");

    // Sample 500 institutions that have a canonical authority
    const samples = await College.aggregate([
        { $match: { authority_canonical: { $exists: true } } },
        { $sample: { size: 500 } },
        { $project: { _id: 0, id: 1, authority_canonical: 1, state: 1 } }
    ]);

    console.log(`Sampled ${samples.length} institutions. Commencing routing audit...`);
    
    let successCount = 0;
    let fallbackCount = 0;
    let failCount = 0;
    let totalLatency = 0;

    for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        const start = Date.now();
        try {
            // Test the exact routing logic using the canonical authority mapping
            const url = `http://localhost:4000/api/colleges?authority=${sample.authority_canonical}&state=${encodeURIComponent(sample.state)}`;
            const res = await axios.get(url);
            const latency = Date.now() - start;
            totalLatency += latency;

            if (res.data && res.data.data && res.data.data.length > 0) {
                if (res.data.meta && res.data.meta.status === "ZERO_RESULT_FALLBACK") {
                    fallbackCount++;
                } else {
                    successCount++;
                }
            } else {
                failCount++;
            }
            await new Promise(resolve => setTimeout(resolve, 50)); // Avoid rate limit
        } catch (e) {
            // Distinguish connection errors from API errors
            if (e.code === 'ECONNREFUSED') {
                console.error("API SERVER IS OFFLINE. Please start the backend on port 5000 before running the audit.");
                process.exit(1);
            }
            failCount++;
        }

        if (i > 0 && i % 50 === 0) {
            console.log(`Processed ${i}/${samples.length}...`);
        }
    }

    console.log("\n=========================================");
    console.log("ZERO-DEAD-END VALIDATION REPORT");
    console.log("=========================================");
    console.log(`Total Samples     : ${samples.length}`);
    console.log(`Pure Success      : ${successCount} (${((successCount/samples.length)*100).toFixed(1)}%)`);
    console.log(`Fallback Triggered: ${fallbackCount} (${((fallbackCount/samples.length)*100).toFixed(1)}%)`);
    console.log(`Dead Ends (Fails) : ${failCount} (${((failCount/samples.length)*100).toFixed(1)}%)`);
    console.log(`Average Latency   : ${Math.round(totalLatency / samples.length)}ms`);
    console.log("=========================================\n");

    process.exit(0);
}

runAudit().catch(console.error);
