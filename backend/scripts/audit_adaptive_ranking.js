const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const connectDB = require('../config/db');
const engineeringPredictorV2Service = require('../services/engineeringPredictorV2Service');
const medicalPredictorV3Service = require('../services/medicalPredictorV3Service');

/**
 * audit_adaptive_ranking.js
 * ===========================
 * Safety audit for the Adaptive Ranking Patch.
 * Ensures that reordering NEVER changes the truth layer (bands/presence).
 */

async function runAudit() {
    console.log("🚀 Starting Adaptive Ranking Safety Audit...");
    await connectDB();
    
    const scenario = { rank: 15000, category: 'OPEN', quota: 'AI', genderPool: 'GENDER_NEUTRAL', authority: 'JOSAA' };

    // 1. Get baseline (Adaptive OFF)
    process.env.ADAPTIVE_RANKING = "false";
    const baseline = await engineeringPredictorV2Service.predictEngineeringV2(scenario);
    
    // 2. Get adaptive (Adaptive ON)
    process.env.ADAPTIVE_RANKING = "true";
    const adaptive = await engineeringPredictorV2Service.predictEngineeringV2(scenario);

    const report = {
        timestamp: new Date().toISOString(),
        test_case: scenario,
        passed: false,
        violations: []
    };

    // --- Safety Check: Completeness ---
    const getIds = (pred) => {
        const sigs = pred.decisionSignals;
        return [...sigs.safe, ...sigs.realistic, ...sigs.risky].map(item => item.institution_id || item.id);
    };

    const baselineIds = getIds(baseline);
    const adaptiveIds = getIds(adaptive);

    if (baselineIds.length !== adaptiveIds.length) {
        report.violations.push(`Completeness Violation: Adaptive returned ${adaptiveIds.length} items, Baseline returned ${baselineIds.length}`);
    }

    // --- Safety Check: Band Preservation ---
    const getBandMap = (pred) => {
        const map = {};
        const sigs = pred.decisionSignals;
        ["safe", "realistic", "risky"].forEach(b => {
            sigs[b].forEach(item => { map[item.institution_id || item.id] = b; });
        });
        return map;
    };

    const baselineBands = getBandMap(baseline);
    const adaptiveBands = getBandMap(adaptive);

    Object.keys(baselineBands).forEach(id => {
        if (baselineBands[id] !== adaptiveBands[id]) {
            report.violations.push(`Truth Violation: Item ${id} changed band from ${baselineBands[id]} to ${adaptiveBands[id]}`);
        }
    });

    report.passed = report.violations.length === 0;

    const reportPath = path.join(__dirname, '../reports/adaptive_ranking_audit.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n✅ Audit Complete.`);
    console.log(`📊 Passed: ${report.passed ? 'YES 🚀' : 'NO ⚠️'}`);
    console.log(`📂 Report: backend/reports/adaptive_ranking_audit.json`);

    process.exit(report.passed ? 0 : 1);
}

runAudit();
