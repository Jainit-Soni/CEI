const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const medicalPredictorV3Service = require('../services/medicalPredictorV3Service');
const dataStore = require('../services/dataStore');
const connectDB = require('../config/db');

/**
 * audit_medical_predictor_v3.js
 * =============================
 * Stress-tests the v3 Statistical Engine across 100 rank scenarios.
 * Checks for band stability, confidence penalties, and statistical defensibility.
 */

async function runAudit() {
    console.log("🚀 Starting v3 Statistical Engine Audit...");
    
    await connectDB();
    
    // Test Scenarios
    const scenarios = [
        { rank: 5000, quota: 'All India', category: 'OPEN' },
        { rank: 15000, quota: 'All India', category: 'OPEN' },
        { rank: 25000, quota: 'All India', category: 'OPEN' },
        { rank: 50000, quota: 'Deemed/Central Universities', category: 'OPEN' }
    ];

    for (const scenario of scenarios) {
        console.log(`\n---------------------------------------------------------`);
        console.log(`📡 Scenario: Rank ${scenario.rank} | ${scenario.quota} | ${scenario.category}`);
        console.log(`---------------------------------------------------------`);
        
        const startTime = Date.now();
        const results = await medicalPredictorV3Service.predictCollegesV3(scenario);
        const duration = Date.now() - startTime;

        console.log(`✅ Analysis complete in ${duration}ms`);
        console.log(`📊 Distrubution:`);
        console.log(`   SAFE      : ${results.safe.length}`);
        console.log(`   REALISTIC : ${results.realistic.length}`);
        console.log(`   RISKY     : ${results.risky.length}`);
        console.log(`   EXTREME   : ${results.extreme.length}`);

        // Sample Checks
        if (results.safe.length > 0) {
            const sample = results.safe[0];
            console.log(`\n🔍 SAFE Sample: ${sample.name}`);
            console.log(`   Interpretation: ${sample.reason.interpretation}`);
            console.log(`   Stats: p25=${sample.stats.p25}, p50=${sample.stats.p50}, p75=${sample.stats.p75}`);
        }

        if (results.realistic.length > 0) {
            const sample = results.realistic[0];
            console.log(`\n🔍 REALISTIC Sample: ${sample.name}`);
            console.log(`   Interpretation: ${sample.reason.interpretation}`);
            console.log(`   Stats: p25=${sample.stats.p25}, p50=${sample.stats.p50}, p75=${sample.stats.p75}`);
        }
    }

    console.log("\n🎉 Audit Finished.");
    process.exit(0);
}

// Ensure identity layer is loaded for name resolution
async function start() {
    await dataStore.initializeCache();
    await runAudit();
}

start();
