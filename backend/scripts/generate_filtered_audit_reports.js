const fs = require('fs');
const readline = require('readline');
const path = require('path');

const matrixFile = path.join(__dirname, '../reports/audit/college_data_matrix.ndjson');
const outputDir = path.join(__dirname, '../reports/audit/filtered');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Outputs
const officialFeesFile = path.join(outputDir, 'colleges_with_official_fees.ndjson');
const officialPlacementsFile = path.join(outputDir, 'colleges_with_official_placements.ndjson');
const coreMissingTruthFile = path.join(outputDir, 'core_institutions_missing_truth.ndjson');
const coreNoSeatsCutoffsFile = path.join(outputDir, 'core_institutions_no_verified_seats_cutoffs.ndjson');

async function generateFilteredReports() {
    console.log("Generating filtered audit reports...");

    // Clear previous
    [officialFeesFile, officialPlacementsFile, coreMissingTruthFile, coreNoSeatsCutoffsFile].forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
    });

    const fileStream = fs.createReadStream(matrixFile);
    const rl = readline.createInterface({ input: fileStream });

    for await (const line of rl) {
        if (!line.trim()) continue;
        const row = JSON.parse(line);

        // Filter 1: Official Fees (truth_grade matches my script's mapping for official_verified)
        if (row.truth_grade === 'official_verified') {
            fs.appendFileSync(officialFeesFile, JSON.stringify(row) + '\n');
        }

        // Filter 2: Official Placements (I tracked placements_present vs legacy in source_quality, but the matrix has fees_verified. I'll use the record flags if I can)
        // Note: matrix doesn't have a 'placement_grade', it has truth_grade for fees. 
        // I'll re-run a quick check for placements if possible, but let's look at the matrix columns again.
        // matrixRow: id, stableKey, name, state, city, aisheCode, website_present, courses_present, fees_present, fees_verified, rankings_present, placements_present, seats_present, cutoffs_present, source_metadata_present, truth_grade, frontend_fee_visible, frontend_placement_visible, frontend_ranking_visible, num_courses, num_rankings, num_placement_fields...
        
        // I need to know if placements were official. I didn't put placement_grade in the matrix. 
        // I will adjust the script to check the raw collection again or use the existing matrix if I can.
    }
    
    console.log("Filtered reports generation complete.");
}

// Since I need more detail than the matrix currently provides (placement_grade), I'll refine the audit script's logic here to hit the DB one more time for these specific filters.
async function generateFilteredMaps() {
    const mongoose = require('mongoose');
    require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
    await mongoose.connect(process.env.MONGODB_URI + 'cei_v2');
    const College = require('../models/CollegeSchema');

    console.log("Querying for filtered verified maps...");

    // 1. Official Fees
    const officialFees = await College.find({ 'fees.isVerified': true }).select('id name fees state').lean();
    fs.writeFileSync(officialFeesFile, officialFees.map(c => JSON.stringify(c)).join('\n') + '\n');

    // 2. Official Placements
    const officialPlacements = await College.find({ 'placements.isVerified': true }).select('id name placements state').lean();
    fs.writeFileSync(officialPlacementsFile, officialPlacements.map(c => JSON.stringify(c)).join('\n') + '\n');

    // 3. Core Institutions missing Official Fees OR Official Placements
    // Define Core
    const coreRegex = /Indian Institute of Technology|National Institute of Technology|Indian Institute of Information Technology|Indian Institute of Management|All India Institute of Medical Sciences|Birla Institute of Technology/i;
    const coreMissing = await College.find({
        $or: [
            { name: coreRegex },
            { isCore: true }
        ],
        $or: [
            { 'fees.isVerified': { $ne: true } },
            { 'placements.isVerified': { $ne: true } }
        ]
    }).select('id name fees placements').lean();
    fs.writeFileSync(coreMissingTruthFile, coreMissing.map(c => JSON.stringify(c)).join('\n') + '\n');

    // 4. Core with no verified seats/cutoffs (which is all of them based on 0% fact)
    const coreNoSeats = await College.find({
        $or: [
            { name: coreRegex },
            { isCore: true }
        ],
        $or: [
            { seats: { $exists: false } },
            { seats: { $size: 0 } },
            { cutoffs: { $exists: false } },
            { cutoffs: { $size: 0 } }
        ]
    }).select('id name seats cutoffs').lean();
    fs.writeFileSync(coreNoSeatsCutoffsFile, coreNoSeats.map(c => JSON.stringify(c)).join('\n') + '\n');

    console.log(`Generated:
- Official Fees: ${officialFees.length}
- Official Placements: ${officialPlacements.length}
- Core Missing Truth: ${coreMissing.length}
- Core No Seats/Cutoffs: ${coreNoSeats.length}
`);
    process.exit(0);
}

generateFilteredMaps().catch(console.error);
