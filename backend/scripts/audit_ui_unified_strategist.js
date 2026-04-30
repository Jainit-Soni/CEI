const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * audit_ui_unified_strategist.js
 * ===============================
 * High-fidelity audit of the advisor logic and content constraints.
 */

const FORBIDDEN_WORDS = ["guaranteed", "impossible", "assured", "certain", "must get"];
const BASE_URL = "http://localhost:4000"; // Backend API

const SCENARIOS = [
    {
        name: "Engineering Strong",
        domain: "engineering",
        params: { rank: 2000, category: "OPEN", quota: "AI", genderPool: "GENDER_NEUTRAL", authority: "JOSAA" }
    },
    {
        name: "Engineering Weak",
        domain: "engineering",
        params: { rank: 50000, category: "OPEN", quota: "AI", genderPool: "GENDER_NEUTRAL", authority: "JOSAA" }
    },
    {
        name: "Medical Realistic",
        domain: "medical",
        params: { rank: 15000, category: "OPEN", quota: "All India", programType: "MBBS", state: "All" }
    },
    {
        name: "Medical Critical",
        domain: "medical",
        params: { rank: 75000, category: "OPEN", quota: "All India", programType: "MBBS", state: "All" }
    }
];

async function runAudit() {
    console.log("🚀 Starting Unified Strategist Logic & Content Audit...");
    const report = {
        scenarios_tested: SCENARIOS.length,
        passed: 0,
        failed: 0,
        failures: [],
        forbidden_language_hits: 0,
        telemetry_verified: false,
        ready_for_demo: false
    };

    for (const scenario of SCENARIOS) {
        try {
            console.log(` -> Testing Scenario: ${scenario.name}`);
            
            // 1. Get Prediction
            const endpoint = scenario.domain === 'engineering' ? '/api/predict/engineering-v2' : '/api/medical/predict';
            const predRes = await axios.get(`${BASE_URL}${endpoint}`, { params: scenario.params });
            const prediction = predRes.data;

            // 2. Get Journey
            const journeyRes = await axios.post(`${BASE_URL}/api/journey`, {
                domain: scenario.domain,
                rank: scenario.params.rank,
                predictionResult: prediction
            });
            const journey = journeyRes.data;

            // 3. Get Best Path
            const bpRes = await axios.post(`${BASE_URL}/api/best-path`, {
                domain: scenario.domain,
                journeyOutput: journey
            });
            const bestPaths = bpRes.data.best_paths;

            // --- Audit Logic ---

            // Check BPG length
            if (bestPaths.length < 1 || bestPaths.length > 5) {
                report.failures.push(`${scenario.name}: BPG returned ${bestPaths.length} paths (Expected 1-5)`);
            }

            // Check Evidence
            bestPaths.forEach((path, i) => {
                if (!path.evidence_refs || path.evidence_refs.length === 0) {
                    report.failures.push(`${scenario.name}: Path #${i+1} missing evidence refs`);
                }
            });

            // Check Forbidden Language
            const fullText = JSON.stringify({ prediction, journey, bestPaths }).toLowerCase();
            FORBIDDEN_WORDS.forEach(word => {
                if (fullText.includes(word)) {
                    report.forbidden_language_hits++;
                    report.failures.push(`${scenario.name}: Forbidden language found: "${word}"`);
                }
            });

            // Check Risk Profile Consistency
            if (scenario.name.includes("Strong") && journey.current_state.risk_profile !== "STRONG") {
                report.failures.push(`${scenario.name}: Incorrect Risk Profile (Expected STRONG, got ${journey.current_state.risk_profile})`);
            }
            if (scenario.name.includes("Critical") && journey.current_state.risk_profile !== "CRITICAL") {
                report.failures.push(`${scenario.name}: Incorrect Risk Profile (Expected CRITICAL, got ${journey.current_state.risk_profile})`);
            }

            report.passed++;
        } catch (err) {
            console.error(`Error in scenario ${scenario.name}:`, err.message);
            report.failures.push(`${scenario.name}: API Error: ${err.message}`);
            report.failed++;
        }
    }

    // Telemetry Verification (Simulate a run)
    try {
        await axios.post(`${BASE_URL}/api/predictor/telemetry/run`, {
            session_id: "audit-session",
            domain: "engineering",
            input: { rank: 1000 }
        });
        report.telemetry_verified = true;
    } catch (e) {
        report.failures.push(`Telemetry: POST failed`);
    }

    report.ready_for_demo = report.failed === 0 && report.forbidden_language_hits === 0 && report.telemetry_verified;

    const reportPath = path.join(__dirname, '../reports/unified_strategist_ui_audit.json');
    if (!fs.existsSync(path.dirname(reportPath))) fs.mkdirSync(path.dirname(reportPath));
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n✅ Audit Complete.`);
    console.log(`📊 Result: ${report.ready_for_demo ? 'READY FOR DEMO 🚀' : 'BLOCKED ⚠️'}`);
    console.log(`📂 Report: backend/reports/unified_strategist_ui_audit.json`);

    process.exit(report.ready_for_demo ? 0 : 1);
}

// Wait a moment for server to start
setTimeout(runAudit, 5000);
