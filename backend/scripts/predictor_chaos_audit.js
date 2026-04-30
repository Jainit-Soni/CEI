const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const connectDB = require('../config/db');
const engineeringPredictorV2Service = require('../services/engineeringPredictorV2Service');
const medicalPredictorV3Service = require('../services/medicalPredictorV3Service');

/**
 * predictor_chaos_audit.js
 * =========================
 * Adversarial chaos audit to stress-test predictors against messy inputs.
 */

const FORBIDDEN_WORDS = ["guaranteed", "impossible", "assured", "certain", "must get", "definitely"];

const RANK_CHAOS = ["", "abc", "-500", "0", "999999999", "15,000", " 15000 "];
const ENG_CAT_CHAOS = ["GEN", "General", "OPEN", "OBC", "OBC-NCL", "SC", "ST", "ews"];
const MED_CAT_CHAOS = ["General", "OPEN", "OBC", "EWS", "SC", "ST"];
const ENG_QUOTA_CHAOS = ["AI", "All India", "ALL_INDIA", "HS", "Home State"];
const MED_QUOTA_CHAOS = ["AIQ", "All India", "Deemed", "NRI"];
const EXTREME_RANKS = [1, 500, 25000, 100000, 500000, 2000000];

async function runChaosAudit() {
    console.log("🔥 Starting Real-World Predictor Chaos Test Suite...");
    await connectDB();
    const dataStore = require('../services/dataStore');
    await dataStore.initializeCache();

    const report = {
        timestamp: new Date().toISOString(),
        total_tests: 0,
        passed: 0,
        failed: 0,
        error_500_count: 0,
        invalid_input_handled: 0,
        normalization_failures: 0,
        forbidden_language_hits: 0,
        anomaly_flags: 0,
        contract_errors: 0,
        failures: []
    };

    const runTest = async (domain, scenario) => {
        report.total_tests++;
        try {
            let res;
            if (domain === 'engineering') {
                res = await engineeringPredictorV2Service.predictEngineeringV2({
                    rank: scenario.rank,
                    category: scenario.category || 'OPEN',
                    quota: scenario.quota || 'AI',
                    genderPool: 'GENDER_NEUTRAL',
                    authority: 'JOSAA'
                });
            } else {
                res = await medicalPredictorV3Service.predictCollegesV3({
                    rank: scenario.rank,
                    category: scenario.category || 'OPEN',
                    quota: scenario.quota || 'All India',
                    programType: 'MBBS'
                });
            }

            // 1. Contract Stability
            const requiredFields = ["domain", "engineVersion", "identityConfidence", "truthStatus", "decisionSignals"];
            requiredFields.forEach(f => {
                if (!(f in res)) {
                    report.contract_errors++;
                    report.failures.push({ domain, scenario, type: 'Contract Missing', detail: f });
                }
            });

            const signals = res.decisionSignals;
            const allItems = [...signals.safe, ...signals.realistic, ...signals.risky, ...(signals.not_observed || [])];

            // 2. Forbidden Language Scan
            allItems.forEach(item => {
                const text = JSON.stringify(item).toLowerCase();
                FORBIDDEN_WORDS.forEach(word => {
                    if (text.includes(word)) {
                        report.forbidden_language_hits++;
                        report.failures.push({ domain, scenario, type: 'Forbidden Word', detail: word });
                    }
                });
            });

            // 3. Anomaly Monitor
            const safeCount = signals.safe.length;
            const totalCount = allItems.length;
            const rankVal = parseInt(scenario.rank.toString().replace(/,/g, ''));
            
            if (rankVal > 50000 && totalCount > 0 && (safeCount / totalCount) > 0.7) {
                report.anomaly_flags++;
                report.failures.push({ domain, scenario, type: 'Anomaly: Too many SAFE results for high rank', detail: `${safeCount}/${totalCount}` });
            }

            // Empty state check for common cases
            if (rankVal === 25000 && totalCount === 0) {
                report.anomaly_flags++;
                report.failures.push({ domain, scenario, type: 'Anomaly: Empty results for common rank (25k)', detail: 'Zero results' });
            }

            report.passed++;
        } catch (err) {
            if (err.message.includes("Invalid rank") || err.message.includes("Missing parameters")) {
                report.invalid_input_handled++;
                report.passed++;
            } else {
                report.error_500_count++;
                report.failed++;
                report.failures.push({ domain, scenario, type: '500 Error', detail: err.message });
            }
        }
    };

    // --- 1. Rank Chaos ---
    console.log("🧪 Testing Rank Chaos...");
    for (const rank of RANK_CHAOS) {
        await runTest('engineering', { rank });
        await runTest('medical', { rank });
    }

    // --- 2. Category Normalization ---
    console.log("🧪 Testing Category Normalization...");
    for (const category of ENG_CAT_CHAOS) {
        await runTest('engineering', { rank: 10000, category });
    }
    for (const category of MED_CAT_CHAOS) {
        await runTest('medical', { rank: 10000, category });
    }

    // --- 3. Quota Normalization ---
    console.log("🧪 Testing Quota Normalization...");
    for (const quota of ENG_QUOTA_CHAOS) {
        await runTest('engineering', { rank: 10000, quota });
    }
    for (const quota of MED_QUOTA_CHAOS) {
        await runTest('medical', { rank: 10000, quota });
    }

    // --- 4. Extreme Ranks ---
    console.log("🧪 Testing Extreme Ranks...");
    for (const rank of EXTREME_RANKS) {
        await runTest('engineering', { rank });
        await runTest('medical', { rank });
    }

    report.pass_rate = ((report.passed / report.total_tests) * 100).toFixed(2) + "%";
    
    const reportPath = path.join(__dirname, '../reports/predictor_chaos_audit.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n💥 Chaos Audit Complete.`);
    console.log(`📊 Pass Rate: ${report.pass_rate}`);
    console.log(`📊 500 Errors: ${report.error_500_count}`);
    console.log(`📊 Forbidden Words: ${report.forbidden_language_hits}`);
    console.log(`📂 Report: backend/reports/predictor_chaos_audit.json`);

    process.exit(report.error_500_count > 0 ? 1 : 0);
}

runChaosAudit();
