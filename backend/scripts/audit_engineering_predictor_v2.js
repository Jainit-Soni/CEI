const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const connectDB = require('../config/db');
const engineeringPredictorV2Service = require('../services/engineeringPredictorV2Service');

/**
 * audit_engineering_predictor_v2.js
 * =================================
 * Stress-tests the v2 Engineering predictor and validates boundary logic.
 */

const scenarios = [
    { rank: 500, category: 'OPEN', quota: 'AI', genderPool: 'Gender-Neutral', authority: 'JOSAA' },
    { rank: 2000, category: 'OBC-NCL', quota: 'AI', genderPool: 'Gender-Neutral', authority: 'JOSAA' },
    { rank: 10000, category: 'SC', quota: 'AI', genderPool: 'Gender-Neutral', authority: 'CSAB' },
    { rank: 25000, category: 'OPEN', quota: 'AI', genderPool: 'Gender-Neutral', authority: 'ALL' },
    { rank: 50000, category: 'ST', quota: 'AI', genderPool: 'Gender-Neutral', authority: 'CSAB' }
];

async function runAudit() {
    console.log("🚀 Starting Engineering Predictor V2 Audit...");
    await connectDB();

    const report = {
        summary: {
            total_scenarios: scenarios.length,
            passed: 0,
            failed: 0,
            violations: []
        },
        results: []
    };

    for (const scenario of scenarios) {
        console.log(`📡 Testing Scenario: Rank ${scenario.rank} | ${scenario.category} | ${scenario.authority}`);
        try {
            const prediction = await engineeringPredictorV2Service.predictEngineeringV2(scenario);
            const signals = prediction.decisionSignals;
            
            let scenarioPassed = true;
            const scenarioViolations = [];

            // Helper to check boundaries
            const checkBoundaries = (list, type) => {
                list.forEach(item => {
                    if (type === 'SAFE' && scenario.rank >= item.strictBoundary) {
                        scenarioViolations.push(`${item.institute_name}: SAFE violation (Rank ${scenario.rank} >= ${item.strictBoundary})`);
                    }
                    if (type === 'REALISTIC' && (scenario.rank < item.strictBoundary || scenario.rank > item.looseBoundary)) {
                        scenarioViolations.push(`${item.institute_name}: REALISTIC violation (Rank ${scenario.rank} not in [${item.strictBoundary}, ${item.looseBoundary}])`);
                    }
                    if (type === 'RISKY' && scenario.rank <= item.looseBoundary) {
                        scenarioViolations.push(`${item.institute_name}: RISKY violation (Rank ${scenario.rank} <= ${item.looseBoundary})`);
                    }
                    
                    // Authority Leakage Check
                    if (scenario.authority !== 'ALL' && item.authority && item.authority !== scenario.authority) {
                        scenarioViolations.push(`${item.institute_name}: Authority leakage (Expected ${scenario.authority}, got ${item.authority})`);
                    }
                });
            };

            checkBoundaries(signals.safe, 'SAFE');
            checkBoundaries(signals.realistic, 'REALISTIC');
            checkBoundaries(signals.risky, 'RISKY');

            // Empty result check for common scenarios
            if (scenario.category === 'OPEN' && signals.safe.length === 0 && signals.realistic.length === 0 && signals.risky.length === 0) {
                scenarioViolations.push("Empty results for OPEN category");
            }

            if (scenarioViolations.length > 0) {
                scenarioPassed = false;
                report.summary.violations.push(...scenarioViolations);
            }

            if (scenarioPassed) report.summary.passed++;
            else report.summary.failed++;

            report.results.push({
                scenario,
                counts: {
                    safe: signals.safe.length,
                    realistic: signals.realistic.length,
                    risky: signals.risky.length
                },
                passed: scenarioPassed,
                violations: scenarioViolations
            });

        } catch (err) {
            console.error(`❌ Scenario failed: ${err.message}`);
            report.summary.failed++;
        }
    }

    const reportDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);
    fs.writeFileSync(path.join(reportDir, 'engineering_predictor_v2_audit.json'), JSON.stringify(report, null, 2));

    console.log(`\n✅ Audit Complete.`);
    console.log(`📊 Passed: ${report.summary.passed}/${scenarios.length}`);
    console.log(`📊 Violations: ${report.summary.violations.length}`);
    console.log(`📂 Report: backend/reports/engineering_predictor_v2_audit.json`);

    process.exit(0);
}

runAudit();
