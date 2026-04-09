require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function run() {
    await connectDB();
    
    const reportDir = path.join(__dirname, '../reports/nirf_2024');
    const summaryPath = path.join(reportDir, 'nirf_2024_mapping_summary.json');
    const rankingTruthPath = path.join(__dirname, '../data/truth/core_rankings_nirf_v2.ndjson');
    const placementTruthPath = path.join(__dirname, '../data/truth/linked/nirf_2024_placements.ndjson');
    const ledgerPath = path.join(reportDir, 'nirf_2024_promotion_ledger.ndjson');

    if (!fs.existsSync(summaryPath)) {
        console.error("❌ Mapping summary not found. Run analysis first.");
        process.exit(1);
    }

    const summary = JSON.parse(fs.readFileSync(summaryPath));
    const mappings = summary.details.filter(d => d.status === 'mapped');
    
    // Create lookup maps for fast access during stream
    const rankingMap = new Map();
    const placementMap = new Map();
    const nameMap = new Map();

    mappings.forEach(m => {
        if (m.type === 'ranking') rankingMap.set(m.name, m.mongoId);
        if (m.type === 'placement') {
             if (m.aishe) placementMap.set(m.aishe, m.mongoId);
             if (m.name) nameMap.set(m.name, m.mongoId);
        }
    });

    console.log(`🚀 Starting NIRF 2024 Live Ingest (${mappings.length} deterministic links)...`);

    const ledgerStream = fs.createWriteStream(ledgerPath);
    let rankingUpdates = 0;
    let placementUpdates = 0;

    // Phase B: Rankings
    console.log("🏆 Processing Rankings...");
    const rlRankings = readline.createInterface({
        input: fs.createReadStream(rankingTruthPath),
        crlfDelay: Infinity
    });

    for await (const line of rlRankings) {
        if (!line.trim()) continue;
        const row = JSON.parse(line);
        const mongoId = rankingMap.get(row.name);
        if (!mongoId) continue;

        const college = await College.findOne({ id: mongoId });
        if (!college) continue;

        const before = JSON.parse(JSON.stringify(college.rankings || []));
        
        // Non-destructive merge logic
        const exists = college.rankings.find(r => 
            r.source === "NIRF" && 
            r.year === "2024" && 
            r.category === row.category
        );

        if (!exists) {
            college.rankings.push({
                source: "NIRF",
                rank: row.rank,
                year: "2024",
                category: row.category
            });
            
            college.sourceMetadata = {
                ...college.sourceMetadata,
                lastInboundSource: "NIRF 2024",
                promotedAt: new Date()
            };

            await college.save();
            rankingUpdates++;

            ledgerStream.write(JSON.stringify({
                collegeId: mongoId,
                type: "RANKING_UPDATE",
                category: row.category,
                before,
                after: college.rankings,
                timestamp: new Date().toISOString()
            }) + '\n');
        }
    }

    // Phase C: Placements
    console.log("💰 Processing Placements...");
    const rlPlacements = readline.createInterface({
        input: fs.createReadStream(placementTruthPath),
        crlfDelay: Infinity
    });

    for await (const line of rlPlacements) {
        if (!line.trim()) continue;
        const row = JSON.parse(line);
        console.log(`🔍 [DEBUG] Ingest loop processing placement: "${row.name}" (ID: ${row.collegeId})`);
        let mongoId = placementMap.get(row.collegeId);
        
        // Fallback to name-based lookup if AISHE is missing in source but present in bridge
        if (!mongoId && row.name) {
            mongoId = nameMap.get(row.name);
        }
        
        if (!mongoId) {
            // console.log(`Skipping placement: ${row.name || row.collegeId} (No match in map)`);
            continue;
        }

        const college = await College.findOne({ id: mongoId });
        if (!college) {
            console.warn(`⚠️ College not found in DB: ${mongoId}`);
            continue;
        }

        console.log(`💰 Matching placement for ${college.name} (${mongoId})...`);
        const before = JSON.parse(JSON.stringify(college.placements || {}));
        
        // Update check
        const isNewer = !college.placements || !college.placements.academicYear || college.placements.academicYear !== "2023-24";
        const isBetterSource = !college.placements || college.placements.source !== "NIRF 2024";
        const isInvalidValue = college.placements && (
            !college.placements.averagePackageNumeric || 
            college.placements.averagePackageNumeric === 0 || 
            college.placements.averagePackage === "0"
        );

        if (isNewer || isBetterSource || isInvalidValue) {
            const rawVal = (row.medianSalary || row.averagePackage || "0").toString().replace(/,/g, '');
            const numericVal = parseInt(rawVal);
            
            console.log(`💰 [DEBUG] ${college.id} (${college.name}): raw=${rawVal}, numeric=${numericVal}`);

            college.placements = {
                averagePackage: rawVal,
                averagePackageNumeric: numericVal,
                academicYear: "2023-24",
                source: "NIRF 2024",
                isVerified: true
            };

            college.sourceMetadata = {
                ...college.sourceMetadata,
                lastInboundSource: "NIRF 2024",
                promotedAt: new Date()
            };

            await college.save();
            placementUpdates++;

            ledgerStream.write(JSON.stringify({
                collegeId: mongoId,
                type: "PLACEMENT_UPDATE",
                before,
                after: college.placements,
                timestamp: new Date().toISOString()
            }) + '\n');
        }
    }

    ledgerStream.end();
    
    const summaryResult = {
        timestamp: new Date().toISOString(),
        rankingUpdates,
        placementUpdates,
        totalMutations: rankingUpdates + placementUpdates
    };
    fs.writeFileSync(path.join(reportDir, 'nirf_2024_promotion_summary.json'), JSON.stringify(summaryResult, null, 2));

    console.log(`✅ NIRF Ingest Complete! Rankings: ${rankingUpdates}, Placements: ${placementUpdates}`);
    
    mongoose.connection.close();
}

run().catch(err => {
    console.error("NIRF Ingest failed:", err);
    process.exit(1);
});
