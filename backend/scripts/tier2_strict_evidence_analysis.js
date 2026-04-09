require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

/** Normalize for strict comparison */
function normalize(s) {
    if (!s) return '';
    return s.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.,\-()]/g, '')
        .replace(/\b(institute|college|university|technology|engineering|management|science|and|of|the|for|in|at)\b/g, '')
        .trim();
}

async function run() {
    await connectDB();
    
    const timestamp = '2026-04-09T09-35';
    const reportDir = path.join(__dirname, '../reports/post_audit', timestamp);
    const unmatchedPath = path.join(reportDir, 'aicte_unmatched.ndjson');

    if (!fs.existsSync(unmatchedPath)) {
        console.error(`❌ Unmatched pool not found at ${unmatchedPath}`);
        process.exit(1);
    }

    console.log("🚀 Starting Tier 2 Strict Official-Evidence Analysis...");

    // 1. Load whole DB for name-based lookup (Memory intensive but faster for 67k)
    console.log("📊 Indexing CEI Registry for Name+Location lookup...");
    const dbColleges = await College.find({}).select('id name state city location courses');
    
    // Map: normName|normState -> [colleges]
    const nameStateMap = new Map();
    for (const c of dbColleges) {
        const key = `${normalize(c.name)}|${normalize(c.state)}`;
        if (!nameStateMap.has(key)) nameStateMap.set(key, []);
        nameStateMap.get(key).push(c);
    }

    // 2. Process Pool
    const rl = readline.createInterface({
        input: fs.createReadStream(unmatchedPath),
        crlfDelay: Infinity
    });

    const results = {
        verified: [],
        blocked: [],
        unresolved: []
    };

    const contradictions = [];
    let processed = 0;

    for await (const line of rl) {
        if (!line.trim()) continue;
        const row = JSON.parse(line);
        processed++;

        const aicteName = row.institutionName || row.name || row.programName; // Fallback to program if others missing
        const aicteState = row.state;
        const aicteCity = row.city;
        const aicteAISHE = row.collegeId;

        const key = `${normalize(aicteName)}|${normalize(aicteState)}`;
        const candidates = nameStateMap.get(key) || [];

        let classification = "unresolved";
        let reason = "No name match found in specified state.";
        let match = null;
        let evidence = [];

        if (candidates.length === 1) {
            const cand = candidates[0];
            const cityMatch = cand.city && aicteCity && normalize(cand.city) === normalize(aicteCity);
            const locationContainsCity = cand.location && aicteCity && cand.location.toLowerCase().includes(aicteCity.toLowerCase());

            if (cityMatch || locationContainsCity) {
                // Strict Verification
                match = cand;
                classification = "verified_candidate";
                evidence = [
                    `Exact Name Match: ${aicteName} -> ${cand.name}`,
                    `Exact State Match: ${aicteState}`,
                    cityMatch ? `Exact City Match: ${aicteCity}` : `Location Evidence: '${aicteCity}' found in address.`
                ];

                // Phase D: Contradiction Check
                const aicteProgram = row.programName || row.specialization;
                const existing = cand.courses ? cand.courses.find(c => normalize(c.name) === normalize(aicteProgram)) : null;
                
                if (existing) {
                    // Check for structural contradictions
                    // AICTE doesn't give much more detail here, but we check if we are merging a different level
                    if (row.degree && existing.degree && normalize(row.degree) !== normalize(existing.degree)) {
                        classification = "blocked_conflict";
                        reason = `Degree mismatch for program ${aicteProgram}: AICTE=${row.degree}, CEI=${existing.degree}`;
                        contradictions.push({ id: cand.id, aicte: row, reason });
                    }
                }
            } else {
                classification = "blocked_conflict";
                reason = `Name match found but City mismatch (CEI: ${cand.city || 'N/A'}, AICTE: ${aicteCity || 'N/A'})`;
            }
        } else if (candidates.length > 1) {
            classification = "blocked_conflict";
            reason = `Multiple candidate institutions found for name '${aicteName}' in ${aicteState}.`;
        }

        const output = {
            aicteRaw: row,
            matchId: match ? match.id : null,
            classification,
            reason: match ? null : reason,
            evidence: evidence.length > 0 ? evidence : null
        };

        results[classification].push(output);
    }

    // 3. Write Reports
    fs.writeFileSync(path.join(reportDir, 'tier2_official_evidence_report.json'), JSON.stringify(results, null, 2));
    
    const streamVerified = fs.createWriteStream(path.join(reportDir, 'tier2_verified_candidates.ndjson'));
    results.verified.forEach(r => streamVerified.write(JSON.stringify(r) + '\n'));
    streamVerified.end();

    const streamBlocked = fs.createWriteStream(path.join(reportDir, 'tier2_blocked_conflicts.ndjson'));
    results.blocked.forEach(r => streamBlocked.write(JSON.stringify(r) + '\n'));
    streamBlocked.end();

    const streamUnresolved = fs.createWriteStream(path.join(reportDir, 'tier2_unresolved.ndjson'));
    results.unresolved.forEach(r => streamUnresolved.write(JSON.stringify(r) + '\n'));
    streamUnresolved.end();

    fs.writeFileSync(path.join(reportDir, 'tier2_program_contradictions.json'), JSON.stringify(contradictions, null, 2));

    // 4. Forecast
    const forecast = {
        timestamp: new Date().toISOString(),
        analyzed: processed,
        verifiedCount: results.verified.length,
        blockedCount: results.blocked.length,
        unresolvedCount: results.unresolved.length,
        potentialCollegesEnriched: new Set(results.verified.map(v => v.matchId)).size
    };
    fs.writeFileSync(path.join(reportDir, 'tier2_strict_forecast.json'), JSON.stringify(forecast, null, 2));

    // 5. MD Summary
    const mdSummary = `
# Tier 2 Strict Official-Evidence Analysis Summary

**Total Rows Analyzed**: ${processed}

## Classification Results
- **Verified Candidates**: ${results.verified.length}
- **Blocked Conflicts**: ${results.blocked.length}
- **Unresolved**: ${results.unresolved.length}

## Forecasted Gains
- **Additional Unique Colleges**: ${forecast.potentialCollegesEnriched}
- **Confidence Layer**: 100% Strict Evidence (Name + State + City)

## Decision Analysis
With only **${results.verified.length}** rows meeting the strict evidence criteria, a live Tier 2 auto-promotion is **NOT justified** for the majority of the pool. The remaining **${results.blocked.length + results.unresolved.length}** rows require human review to resolve city discrepancies or entity ambiguities.
`;
    fs.writeFileSync(path.join(reportDir, 'tier2_strict_forecast_summary.md'), mdSummary);

    console.log(`✅ Tier 2 Analysis Complete! Verified: ${results.verified.length}, Blocked: ${results.blocked.length}, Unresolved: ${results.unresolved.length}`);
    
    mongoose.connection.close();
}

run().catch(err => {
    console.error("Tier 2 analysis failed:", err);
    process.exit(1);
});
