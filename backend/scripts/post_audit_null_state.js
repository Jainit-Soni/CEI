require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function run() {
    await connectDB();
    
    const timestamp = process.argv[2] || '2026-04-09T09-35';
    const reportDir = path.join(__dirname, '../reports/post_audit', timestamp);
    
    console.log("🚀 Starting Null-State Analysis...");

    // 1. Build City -> State Reference Map from high-confidence records
    console.log("📊 Building City-to-State probability map from existing database records...");
    const cityStateMap = new Map();
    const allValid = await College.find({ state: { $ne: null, $ne: "" }, city: { $ne: null, $ne: "" } }).select('city state');
    
    for (const rec of allValid) {
        if (!rec.city) continue;
        const city = rec.city.toLowerCase().trim();
        const state = rec.state ? rec.state.trim() : null;
        if (!state) continue;
        if (!cityStateMap.has(city)) cityStateMap.set(city, {});
        cityStateMap.get(city)[state] = (cityStateMap.get(city)[state] || 0) + 1;
    }

    // 2. Identify State List for Address Matching
    const states = [...new Set(allValid.map(r => r.state ? r.state.trim() : null).filter(Boolean))];
    console.log(`✅ Built map for ${cityStateMap.size} cities. Identified ${states.length} states.`);

    // 3. Analyze records with null state
    const nullRecords = await College.find({ state: { $eq: null } }).select('name location city website id aisheCode');
    console.log(`🔍 Analyzing ${nullRecords.length} records with null state.`);

    const report = {
        timestamp: new Date().toISOString(),
        totalAnalyzed: nullRecords.length,
        resolved: 0,
        uncertain: 0,
        proposedFixes: []
    };

    for (const rec of nullRecords) {
        let proposedState = null;
        let confidence = 0;
        let method = null;
        let evidence = "";

        // Strategy A: City Lookup
        if (rec.city) {
            const cityKey = rec.city.toLowerCase().trim();
            const possibleStates = cityStateMap.get(cityKey);
            if (possibleStates) {
                const sorted = Object.entries(possibleStates).sort((a,b) => b[1] - a[1]);
                const totalCityRecords = Object.values(possibleStates).reduce((a,b) => a+b, 0);
                const topState = sorted[0][0];
                const topCount = sorted[0][1];
                const percentage = (topCount / totalCityRecords) * 100;

                if (percentage > 95) {
                    proposedState = topState;
                    confidence = percentage;
                    method = "City-to-State Mapping";
                    evidence = `City '${rec.city}' matches ${topState} with ${percentage.toFixed(1)}% probability in DB.`;
                }
            }
        }

        // Strategy B: Address/Location Parsing (if Strategy A failed or low confidence)
        if (!proposedState && rec.location) {
            for (const stateName of states) {
                if (rec.location.toLowerCase().includes(stateName.toLowerCase())) {
                    proposedState = stateName;
                    confidence = 98;
                    method = "Address/Location Parsing";
                    evidence = `Found state name '${stateName}' in location text: "${rec.location}"`;
                    break;
                }
            }
        }

        // Strategy C: Name Parsing
        if (!proposedState && rec.name) {
             for (const stateName of states) {
                if (rec.name.toLowerCase().includes(stateName.toLowerCase())) {
                    proposedState = stateName;
                    confidence = 90; // Reduced as names can have state names but be elsewhere (e.g. "Kerla College in Delhi")
                    method = "Name Keyword Match";
                    evidence = `Found state name '${stateName}' in college name.`;
                    break;
                }
            }
        }

        if (proposedState && confidence >= 95) {
            report.proposedFixes.push({
                id: rec.id,
                name: rec.name,
                currentCity: rec.city,
                currentLocation: rec.location,
                proposedState,
                confidence,
                method,
                evidence
            });
            report.resolved++;
        } else {
            report.proposedFixes.push({
                id: rec.id,
                name: rec.name,
                currentCity: rec.city,
                currentLocation: rec.location,
                proposedState: "UNRESOLVED",
                confidence: 0,
                method: "NONE",
                evidence: "No definitive signal found."
            });
            report.uncertain++;
        }
    }

    const reportPath = path.join(reportDir, 'null_state_repair_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`✅ Analysis complete! Resolved: ${report.resolved}, Uncertain: ${report.uncertain}.`);
    console.log(`Report saved to ${reportPath}`);
    
    mongoose.connection.close();
}

run().catch(err => {
    console.error("Null-state analysis failed:", err);
    process.exit(1);
});
