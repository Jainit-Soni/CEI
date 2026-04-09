require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function run() {
    await connectDB();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const reportDir = path.join(__dirname, '../reports/post_audit', timestamp);
    
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    console.log(`🚀 Starting Baseline Snapshot to ${reportDir}...`);

    const cursor = College.find({}).cursor();
    const filePath = path.join(reportDir, 'pre_truth_resync_baseline.ndjson');
    const writeStream = fs.createWriteStream(filePath);

    let count = 0;
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        writeStream.write(JSON.stringify(doc) + '\n');
        count++;
        if (count % 5000 === 0) {
            console.log(`📦 Snapshotted ${count} documents...`);
        }
    }

    writeStream.end();
    console.log(`✅ Baseline Snapshot complete! ${count} documents saved to ${filePath}`);
    
    // Save a small JSON summary for easy access
    const summary = {
        timestamp: new Date().toISOString(),
        totalRecords: count,
        snapshotFile: 'pre_truth_resync_baseline.ndjson'
    };
    fs.writeFileSync(path.join(reportDir, 'baseline_summary.json'), JSON.stringify(summary, null, 2));

    mongoose.connection.close();
    console.log('Timestamp folder created:', timestamp);
}

run().catch(err => {
    console.error("Baseline snapshot failed:", err);
    process.exit(1);
});
