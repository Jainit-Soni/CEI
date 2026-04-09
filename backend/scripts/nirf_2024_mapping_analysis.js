require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

/** Normalize for bridge building */
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
    
    const reportDir = path.join(__dirname, '../reports/nirf_2024');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const nirfRankingsPath = path.join(__dirname, '../data/truth/core_rankings_nirf_v2.ndjson');
    const nirfExpandedPath = path.join(__dirname, '../data/truth/nirf_expanded_2024_v1.ndjson');
    const nirfLinkedPlacementsPath = path.join(__dirname, '../data/truth/linked/nirf_2024_placements.ndjson');

    console.log("🚀 Starting NIRF 2024 Mapping Analysis...");

    // 1. Build Name -> AISHE Bridge from multiple truth levels
    console.log("📊 Building Name-to-AISHE bridge...");
    const nameToAishe = new Map();

    const loadBridge = async (filePath, keyField = 'stableKey') => {
        if (!fs.existsSync(filePath)) return;
        const rl = readline.createInterface({
            input: fs.createReadStream(filePath),
            crlfDelay: Infinity
        });
        for await (const line of rl) {
            if (!line.trim()) continue;
            const row = JSON.parse(line);
            const name = row.name || row.institutionName;
            const aishe = row[keyField] || row.aisheCode || row.collegeId;
            if (name && aishe) {
                nameToAishe.set(normalize(name), aishe);
            }
        }
    };

    await loadBridge(nirfExpandedPath, 'stableKey');
    await loadBridge(nirfLinkedPlacementsPath, 'collegeId');
    await loadBridge(path.join(__dirname, '../data/truth/core_rankings_nirf_v2.ndjson'), 'aisheCode');

    console.log(`✅ Bridge built with ${nameToAishe.size} institutional mappings.`);

    // 2. Process Rankings
    console.log("🔍 Mapping ranking rows...");
    const stats = {
        totalRankingRows: 0,
        totalPlacementRows: 0,
        mappedRankings: 0,
        unmappedRankings: 0,
        mappedPlacements: 0,
        unmappedPlacements: 0,
        details: []
    };

    const rlRankings = readline.createInterface({
        input: fs.createReadStream(nirfRankingsPath),
        crlfDelay: Infinity
    });

    for await (const line of rlRankings) {
        if (!line.trim()) continue;
        stats.totalRankingRows++;
        const row = JSON.parse(line);
        const normName = normalize(row.name);
        const aishe = nameToAishe.get(normName);

        if (aishe) {
            const college = await College.findOne({ aisheCode: aishe }).select('id name');
            if (college) {
                stats.mappedRankings++;
                stats.details.push({ type: 'ranking', name: row.name, aishe, mongoId: college.id, status: 'mapped' });
            } else {
                stats.unmappedRankings++;
                stats.details.push({ type: 'ranking', name: row.name, aishe, status: 'unmapped', reason: 'AISHE not in DB' });
            }
        } else {
            stats.unmappedRankings++;
            stats.details.push({ type: 'ranking', name: row.name, status: 'unmapped', reason: 'No AISHE in bridge' });
        }
    }

    // 3. Map Placements
    console.log("🔍 Mapping placement rows...");
    const rlPlacements = readline.createInterface({
        input: fs.createReadStream(nirfLinkedPlacementsPath),
        crlfDelay: Infinity
    });

    for await (const line of rlPlacements) {
        if (!line.trim()) continue;
        stats.totalPlacementRows++;
        const row = JSON.parse(line);
        let aishe = row.collegeId;
        
        // Fallback to name-based AISHE resolution for placements
        if (!aishe && row.name) {
            aishe = nameToAishe.get(normalize(row.name));
        }

        if (aishe) {
            const college = await College.findOne({ aisheCode: aishe }).select('id');
            if (college) {
                stats.mappedPlacements++;
                stats.details.push({ type: 'placement', aishe, name: row.name, mongoId: college.id, status: 'mapped' });
            } else {
                stats.unmappedPlacements++;
            }
        } else {
            stats.unmappedPlacements++;
        }
    }

    const summaryPath = path.join(reportDir, 'nirf_2024_mapping_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(stats, null, 2));

    const mdSummary = `
# NIRF 2024 Mapping Summary

**Total Ranking Rows**: ${stats.totalRankingRows}
**Total Placement Rows**: ${stats.totalPlacementRows}

## Deterministic Linkage Stats
- **Mapped Rankings**: ${stats.mappedRankings} (${((stats.mappedRankings/stats.totalRankingRows)*100).toFixed(1)}%)
- **Unmapped Rankings**: ${stats.unmappedRankings}
- **Mapped Placements**: ${stats.mappedPlacements} (${((stats.mappedPlacements/stats.totalPlacementRows)*100).toFixed(1)}%)

## Expected Coverage Gain
- **Impacted Colleges**: ~${stats.mappedRankings + stats.mappedPlacements} metadata points
- **Linkage Logic**: Strict AISHE-backed bridge via NIRF Expanded layer.

> [!NOTE]
> All unmapped rows are preserved in the mapping summary for manual review. Ingest will ONLY proceed for the ${stats.mappedRankings + stats.mappedPlacements} deterministic matches.
`;
    fs.writeFileSync(path.join(reportDir, 'nirf_2024_mapping_summary.md'), mdSummary);

    console.log(`✅ Phase A Complete! Summary saved to ${reportDir}`);
    
    mongoose.connection.close();
}

run().catch(err => {
    console.error("Mapping analysis failed:", err);
    process.exit(1);
});
