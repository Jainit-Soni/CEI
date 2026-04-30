const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// We use the real API for validation
const API_BASE = "http://localhost:4000";

async function runRealAudit() {
    console.log('--- 🛡️  STARTING REAL SYSTEM AUDIT (POST-INGESTION) ---');
    
    require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const College = require('../models/CollegeSchema');

    // 1. Sampling Strategy (20 LOW, 15 MEDIUM, 15 HIGH)
    console.log('🔍 Sampling institutions across tiers...');
    const highSamples = await College.find({ 
        $or: [
            { 'engineeringCutoffs.0': { $exists: true } },
            { 'seatMatrix.0': { $exists: true } }
        ] 
    }).limit(15);

    const mediumSamples = await College.find({ 
        $and: [
            { 'engineeringCutoffs.0': { $exists: false } },
            { 'seatMatrix.0': { $exists: false } },
            { $or: [ { 'fees': { $ne: null } }, { 'courses.0': { $exists: true } } ] }
        ]
    }).limit(15);

    const lowSamples = await College.find({ 
        'engineeringCutoffs.0': { $exists: false },
        'seatMatrix.0': { $exists: false },
        'fees': null,
        'courses.0': { $exists: false }
    }).limit(20);

    const allSamples = [...highSamples, ...mediumSamples, ...lowSamples];
    console.log(`✅ Collected ${allSamples.length} samples for live validation.`);

    const auditResults = [];
    let brokenRoutes = 0;
    let totalLatency = 0;
    let routeCount = 0;

    for (const inst of allSamples) {
        console.log(`📡 Probing: ${inst.id} [${inst.name}]`);
        
        // A. Call Live Page API
        const pageStart = Date.now();
        const pageRes = await fetch(`${API_BASE}/api/college/${inst.id}`);
        const pageLatency = Date.now() - pageStart;

        
        if (!pageRes.ok) {
            console.error(`  ❌ Page API failed: ${pageRes.status}`);
            continue;
        }

        const payload = await pageRes.json();
        const contract = payload.truthContract;
        
        if (!contract || !contract.nextActions) {
            console.error(`  ❌ Missing Truth Contract for ${inst.id}`);
            continue;
        }

        // B. Call Next Action Routes
        const validatedActions = [];
        for (const action of contract.nextActions) {
            routeCount++;
            const queryParams = new URLSearchParams(action.params).toString();
            const actionUrl = `${API_BASE}/api/colleges?${queryParams}`;
            
            const actionStart = Date.now();
            const actionRes = await fetch(actionUrl);
            const actionLatency = Date.now() - actionStart;
            totalLatency += actionLatency;

            const actionData = await actionRes.json();
            const resultsCount = actionData.data ? actionData.data.length : (Array.isArray(actionData) ? actionData.length : 0);


            const isBroken = resultsCount === 0;
            if (isBroken) brokenRoutes++;

            validatedActions.push({
                label: action.label,
                url: actionUrl,
                status: actionRes.status,
                results: resultsCount,
                latency: actionLatency,
                isBroken,
                fallbackApplied: isBroken
            });

            console.log(`    ${isBroken ? '❌' : '✅'} [${actionLatency}ms] ${action.label} -> ${resultsCount} results`);
        }

        auditResults.push({
            id: inst.id,
            name: inst.name,
            tier: contract.truthImportance,
            pageLatency,
            actions: validatedActions
        });
    }

    const report = {
        summary: {
            totalInstitutions: allSamples.length,
            totalRoutesChecked: routeCount,
            brokenRoutesCount: brokenRoutes,
            avgLatencyMs: (totalLatency / routeCount).toFixed(2),
            timestamp: new Date().toISOString()
        },
        results: auditResults
    };

    fs.writeFileSync(path.join(__dirname, '../reports/next_action_real_audit.json'), JSON.stringify(report, null, 2));

    console.log(`\n--- 🏁 AUDIT COMPLETE ---`);
    console.log(`- Broken Routes: ${brokenRoutes}`);
    console.log(`- Avg Latency  : ${(totalLatency / routeCount).toFixed(2)}ms`);
    console.log(`- Report saved to: reports/next_action_real_audit.json`);

    await mongoose.connection.close();
    process.exit(0);
}

runRealAudit().catch(err => {
    console.error(err);
    process.exit(1);
});
