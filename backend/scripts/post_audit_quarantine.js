require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function run() {
    await connectDB();
    
    // Using the timestamp from the baseline run
    const timestamp = process.argv[2] || '2026-04-09T09-35';
    const reportDir = path.join(__dirname, '../reports/post_audit', timestamp);
    
    if (!fs.existsSync(reportDir)) {
        console.error(`❌ Report directory ${reportDir} not found. Run baseline first.`);
        process.exit(1);
    }

    console.log("🚀 Starting Placeholder Quarantine...");

    // Identify placeholders (21 records)
    const query = {
        $or: [
            { name: /TBD/i },
            { name: /Test/i },
            { name: /undefined/i },
            { website: /placeholder/i },
            { 
                $and: [
                    { $or: [{ website: { $exists: false } }, { website: null }, { website: "" }, { website: "N/A" }] },
                    { $or: [{ courses: { $exists: false } }, { courses: { $size: 0 } }] },
                    { $or: [{ "placements.averagePackage": null }, { "placements.averagePackage": "0" }] },
                    { $or: [{ state: null }, { state: "" }] }
                ]
            }
        ]
    };

    const targets = await College.find(query).select('name website state id');
    console.log(`🔍 Found ${targets.length} potential records for quarantine.`);

    const report = {
        timestamp: new Date().toISOString(),
        quarantinedCount: targets.length,
        records: []
    };

    const now = new Date();
    for (const target of targets) {
        let reason = "Detected as placeholder or dead record (zero metadata + no state)";
        if (/TBD/i.test(target.name)) reason = "Name contains TBD";
        else if (/Test/i.test(target.name)) reason = "Name contains Test";
        else if (/placeholder/i.test(target.website)) reason = "Website contains placeholder";

        report.records.push({
            id: target.id,
            name: target.name,
            reason: reason,
            previousState: {
                website: target.website,
                state: target.state
            }
        });

        // Reversible update
        await College.updateOne(
            { id: target.id },
            { 
                $set: { 
                    auditStatus: "quarantined",
                    quarantineReason: reason,
                    quarantinedAt: now
                }
            }
        );
    }

    const reportPath = path.join(reportDir, 'placeholder_quarantine_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`✅ Quarantine complete! ${targets.length} records marked. Report saved to ${reportPath}`);
    
    mongoose.connection.close();
}

run().catch(err => {
    console.error("Quarantine failed:", err);
    process.exit(1);
});
