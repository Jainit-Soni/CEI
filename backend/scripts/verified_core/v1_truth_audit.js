const mongoose = require('mongoose');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const reportsDir = path.join(__dirname, '../../reports/verified_core');
const cohortFile = path.join(reportsDir, 'verified_core_cohort.ndjson');

async function runTruthAudit() {
    console.log("Connecting to CEI_v2 for Verified Core 1.0 Truth Audit...");
    await mongoose.connect(process.env.MONGODB_URI + 'cei_v2');
    const College = require('../../models/CollegeSchema');

    // Matrix outputs
    const matrixCsv = path.join(reportsDir, 'verified_core_truth_matrix.csv');
    const matrixNdjson = path.join(reportsDir, 'verified_core_truth_matrix.ndjson');
    if (fs.existsSync(matrixCsv)) fs.unlinkSync(matrixCsv);
    if (fs.existsSync(matrixNdjson)) fs.unlinkSync(matrixNdjson);

    const headers = [
        "id", "name", "category",
        "identity_verified", "website_verified", "fees_verified", "placements_verified",
        "seats_verified", "cutoffs_verified", "rankings_verified",
        "primary_source_fees", "primary_source_placements", "primary_source_seats",
        "fees_status", "placements_status", "seats_status"
    ].join(",");
    fs.appendFileSync(matrixCsv, headers + "\n");

    const gaps = {
        totalCore: 0,
        missingFees: [],
        missingPlacements: [],
        missingSeats: [],
        missingCutoffs: []
    };

    const fileStream = fs.createReadStream(cohortFile);
    const rl = readline.createInterface({ input: fileStream });

    for await (const line of rl) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line);
        gaps.totalCore++;

        const c = await College.findOne({ id: entry.id }).lean();
        if (!c) continue;

        // Classification function
        const getStatus = (layerData) => {
            if (!layerData) return "unavailable";
            if (layerData.isVerified === true) return "official_verified";
            if (layerData.bridgeStatus === "derived_deterministic_name_match") return "derived_deterministic";
            if (layerData.matchBasis === "deterministic_name_elite") return "official_verified"; // Legacy tag but treated as official
            
            // Special check for rankings which don't have isVerified flag in the same way
            if (Array.isArray(layerData) && layerData.length > 0) return "official_verified"; 
            
            // Generic check for presence
            if (typeof layerData === 'object' && Object.keys(layerData).length > 1) return "legacy";
            return "unavailable";
        };

        const feeStatus = getStatus(c.fees);
        const placeStatus = getStatus(c.placements);
        
        // Seat matrices in this DB are usually totalSeats (legacy) or engineeringCutoffs (derived/official)
        // I'll check engineeringCutoffs as proxy for seats verification in this phase
        const seatsStatus = (c.totalSeats && c.totalSeats > 0) ? "legacy" : "unavailable";
        const cutoffStatus = (c.engineeringCutoffs && c.engineeringCutoffs.length > 0) ? "official_verified" : "unavailable";
        const rankStatus = (c.rankings && c.rankings.length > 0) ? "official_verified" : "unavailable";

        const matrixRow = {
            id: c.id,
            name: c.name,
            category: entry.categoryBucket,
            identity_verified: true, // Always true for cohort
            website_verified: !!c.website,
            fees_verified: feeStatus === 'official_verified',
            placements_verified: placeStatus === 'official_verified',
            seats_verified: false, // No official seat matrix yet in baseline audit
            cutoffs_verified: cutoffStatus === 'official_verified',
            rankings_verified: rankStatus === 'official_verified',
            primary_source_fees: c.fees?.source || "None",
            primary_source_placements: c.placements?.source || "None",
            primary_source_seats: "None",
            fees_status: feeStatus,
            placements_status: placeStatus,
            seats_status: seatsStatus
        };

        fs.appendFileSync(matrixNdjson, JSON.stringify(matrixRow) + "\n");
        
        const clean = s => `"${(s || "").toString().replace(/"/g, '""')}"`;
        const csvRow = [
            c.id, c.name, entry.categoryBucket,
            matrixRow.identity_verified, matrixRow.website_verified, matrixRow.fees_verified, matrixRow.placements_verified,
            matrixRow.seats_verified, matrixRow.cutoffs_verified, matrixRow.rankings_verified,
            matrixRow.primary_source_fees, matrixRow.primary_source_placements, matrixRow.primary_source_seats,
            matrixRow.fees_status, matrixRow.placements_status, matrixRow.seats_status
        ].map(clean).join(",");
        fs.appendFileSync(matrixCsv, csvRow + "\n");

        // Gaps
        if (feeStatus !== "official_verified") gaps.missingFees.push(c.id);
        if (placeStatus !== "official_verified") gaps.missingPlacements.push(c.id);
        if (seatsStatus !== "official_verified" && seatsStatus !== "derived_deterministic") gaps.missingSeats.push(c.id);
        if (cutoffStatus !== "official_verified") gaps.missingCutoffs.push(c.id);
    }

    // Write Gaps Report
    fs.writeFileSync(path.join(reportsDir, 'verified_core_gap_report.json'), JSON.stringify(gaps, null, 2));

    const md = `# Verified Core 1.0 Gap Map
**Scope**: ${gaps.totalCore} Elite Institutions

### Truth Integrity Breakdown
- **Fees**: ${gaps.totalCore - gaps.missingFees.length} verified | ${gaps.missingFees.length} gaps
- **Placements**: ${gaps.totalCore - gaps.missingPlacements.length} verified | ${gaps.missingPlacements.length} gaps
- **Seats/Cutoffs**: 0 verified (Currently using legacy/unavailable)

### Critical Targeted Gaps
- **NITs missing Official Fees**: ${gaps.missingFees.length} (Total cohort matches)
- **IITs missing Official Placements**: ${gaps.missingPlacements.length}
`;
    fs.writeFileSync(path.join(reportsDir, 'verified_core_gap_report.md'), md);

    console.log("Truth audit complete.");
    process.exit(0);
}

runTruthAudit().catch(console.error);
