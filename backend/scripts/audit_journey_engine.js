const fs = require('fs');
const path = require('path');
const journeyEngine = require('../services/journeyEngine');

/**
 * audit_journey_engine.js
 * =========================
 * Adversarial audit for the Journey Engine advice layer.
 */

const FORBIDDEN_WORDS = ["guaranteed", "impossible", "assured", "certain", "must get"];

const SCENARIOS = [
    {
        name: "Engineering Strong",
        domain: "engineering",
        rank: 5000,
        category: "OPEN",
        quota: "ALL_INDIA",
        state: "Maharashtra",
        predictionResult: {
            decisionSignals: { safe: new Array(10), realistic: new Array(5), risky: new Array(2), meta: { authority: "JOSAA" } }
        }
    },
    {
        name: "Medical Critical",
        domain: "medical",
        rank: 100000,
        category: "OPEN",
        quota: "All India",
        program: "MBBS",
        predictionResult: {
            decisionSignals: { safe: [], realistic: [], risky: new Array(5), not_observed: new Array(20) }
        }
    }
];

function runAudit() {
    console.log("🚀 Starting Journey Engine Strategic Audit...");
    const report = {
        timestamp: new Date().toISOString(),
        total_tests: SCENARIOS.length,
        passed: 0,
        failed: 0,
        violations: []
    };

    SCENARIOS.forEach(scenario => {
        try {
            const journey = journeyEngine.generateJourney(scenario);
            let scenarioPassed = true;

            // 1. Forbidden Language Check
            const text = JSON.stringify(journey).toLowerCase();
            FORBIDDEN_WORDS.forEach(word => {
                if (text.includes(word)) {
                    report.violations.push(`${scenario.name}: Forbidden word detected: "${word}"`);
                    scenarioPassed = false;
                }
            });

            // 2. Evidence Integrity
            if (journey.next_moves.length > 0 && journey.evidence.length === 0) {
                report.violations.push(`${scenario.name}: Advice given without evidence.`);
                scenarioPassed = false;
            }

            // 3. Risk Profile Verification
            if (scenario.name === "Engineering Strong" && journey.current_state.risk_profile !== "STRONG") {
                report.violations.push(`${scenario.name}: Incorrect risk profile.`);
                scenarioPassed = false;
            }

            if (scenarioPassed) report.passed++;
            else report.failed++;

        } catch (err) {
            report.violations.push(`${scenario.name}: Execution Error: ${err.message}`);
            report.failed++;
        }
    });

    const reportPath = path.join(__dirname, '../reports/journey_engine_audit.json');
    if (!fs.existsSync(path.dirname(reportPath))) fs.mkdirSync(path.dirname(reportPath));
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n✅ Journey Audit Complete.`);
    console.log(`📊 Pass Rate: ${((report.passed / report.total_tests) * 100).toFixed(2)}%`);
    console.log(`📂 Report: backend/reports/journey_engine_audit.json`);

    process.exit(report.failed > 0 ? 1 : 0);
}

runAudit();
