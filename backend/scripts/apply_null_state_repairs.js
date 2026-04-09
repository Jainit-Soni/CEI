require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function run() {
    await connectDB();
    
    const timestamp = '2026-04-09T09-35';
    const reportDir = path.join(__dirname, '../reports/post_audit', timestamp);
    const reportPath = path.join(reportDir, 'null_state_repair_report.json');
    const ledgerPath = path.join(reportDir, 'selective_promotion_ledger.ndjson');

    if (!fs.existsSync(reportPath)) {
        console.error(`❌ Null-state repair report not found at ${reportPath}`);
        process.exit(1);
    }

    const { proposedFixes } = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const fixesToApply = proposedFixes.filter(f => f.proposedState !== "UNRESOLVED" && f.confidence >= 95);

    console.log(`🚀 Applying ${fixesToApply.length} deterministic null-state repairs...`);

    const ledgerStream = fs.createWriteStream(ledgerPath, { flags: 'a' });
    let appliedCount = 0;

    for (const fix of fixesToApply) {
        const college = await College.findOne({ id: fix.id });
        if (!college) {
            console.warn(`⚠️ College not found: ${fix.id}`);
            continue;
        }

        // Snapshot before
        const before = { state: college.state };

        // Apply fix
        college.state = fix.proposedState;
        college.stateRepairAppliedAt = new Date();
        college.stateRepairSource = "post_audit_pipeline";
        college.stateRepairConfidence = fix.confidence;
        college.stateRepairEvidence = fix.evidence;

        college.markModified('state');
        college.markModified('stateRepairSource');

        await college.save();

        // Log mutation
        const ledgerEntry = {
            collegeId: fix.id,
            mutationType: "NULL_STATE_REPAIR",
            before,
            after: { state: fix.proposedState },
            timestamp: new Date().toISOString(),
            method: fix.method
        };
        ledgerStream.write(JSON.stringify(ledgerEntry) + '\n');
        appliedCount++;
    }

    ledgerStream.end();
    console.log(`✅ Phase A Complete! Applied ${appliedCount} repairs.`);

    const applySummary = {
        phase: "NULL_STATE_REPAIR",
        timestamp: new Date().toISOString(),
        appliedCount
    };
    fs.writeFileSync(path.join(reportDir, 'null_state_apply_report.json'), JSON.stringify(applySummary, null, 2));

    mongoose.connection.close();
}

run().catch(err => {
    console.error("Null-state repair application failed:", err);
    process.exit(1);
});
