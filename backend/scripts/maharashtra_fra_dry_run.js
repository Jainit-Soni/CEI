const fs = require('fs');
const readline = require('readline');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sourceFile = path.join(__dirname, '../data/truth/maharashtra_fra_2024.ndjson');
const candidatesOut = path.join(__dirname, '../reports/fees/maharashtra_fra_dry_run_candidates.ndjson');
const summaryJsonOut = path.join(__dirname, '../reports/fees/maharashtra_fra_mapping_summary.json');
const summaryMdOut = path.join(__dirname, '../reports/fees/maharashtra_fra_mapping_summary.md');

async function runDryRun() {
    console.log("Connecting to CEI Database...");
    await mongoose.connect(process.env.MONGODB_URI + 'cei_v2');
    const College = require('../models/CollegeSchema');

    let totalRows = 0;
    let mappedCount = 0;
    let unmappedCount = 0;
    let conflictsCount = 0;
    
    // Arrays for tracking
    const mappedRows = [];
    const unmappedRows = [];
    
    const fileStream = fs.createReadStream(sourceFile);
    const rl = readline.createInterface({ input: fileStream });

    console.log("Starting deterministic EN-code dry run...");

    for await (const line of rl) {
        if (!line.trim()) continue;
        totalRows++;
        
        try {
            const row = JSON.parse(line);
            const enCode = row.collegeId; // like "EN1101"

            // Strictly Deterministic Mapping
            const match = await College.findOne({
                $or: [
                    { id: enCode },
                    { aisheCode: enCode },
                    { stableKey: enCode },
                    { 'meta.dteCode': enCode },
                    { 'identifiers.dteCode': enCode }
                ]
            }).lean();

            if (match) {
                // Check if existing truth conflicts (already has verified fee that differs)
                let isConflict = false;
                if (match.fees && match.fees.isVerified && match.fees.totalNumeric !== row.totalFee) {
                    isConflict = true;
                    conflictsCount++;
                }

                mappedRows.push({
                    _id: match._id,
                    ceid: match.id,
                    enCode: enCode,
                    sourceName: row.name,
                    dbName: match.name,
                    isConflict,
                    newFee: row.totalFee,
                    oldFee: match.fees?.totalNumeric || null
                });
                mappedCount++;
            } else {
                unmappedRows.push(row);
                unmappedCount++;
            }
        } catch (e) {
            console.error("Error parsing row:", e.message);
        }
    }

    // Generate output
    if (fs.existsSync(candidatesOut)) fs.unlinkSync(candidatesOut);
    const candidateStream = fs.createWriteStream(candidatesOut);
    for (const row of mappedRows) {
        candidateStream.write(JSON.stringify(row) + "\n");
    }
    candidateStream.end();

    const summaryData = {
        totalRows,
        mappedRows: mappedCount,
        unmappedRows: unmappedCount,
        conflictsCount,
        expectedCoverageGain: mappedCount,
        mappingRate: totalRows > 0 ? ((mappedCount / totalRows) * 100).toFixed(2) + "%" : "0%"
    };
    
    fs.writeFileSync(summaryJsonOut, JSON.stringify(summaryData, null, 2));

    const mdReport = `# Maharashtra FRA 2024 Dry-Run Mapping Summary

## Constraints
- **Policy**: Deterministic EN-code Mapping Only
- **Fuzzy Matching**: DISABLED
- **Database Target**: \`cei_v2\`

## Results
- **Total Rows Analyzed**: ${totalRows}
- **Successfully Mapped**: ${mappedCount}
- **Unmapped**: ${unmappedCount}
- **Conflicts detected**: ${conflictsCount}
- **Expected Coverage Gain**: ${mappedCount} verified fees

### Conclusion
As anticipated under strict deterministic constraints, if the MongoDB document does not natively contain the DTE "EN-code" as an identifier (\`id\`, \`stableKey\`, or \`meta.dteCode\`), mapping yield will be low or zero. In order to ingest this structured fee truth, a bridging phase (DTE-to-AISHE) or supervised fuzzy linker must be executed first to populate the necessary identifiers.
`;

    fs.writeFileSync(summaryMdOut, mdReport);

    console.log("Dry run complete. Outputs written to backend/reports/fees/");
    console.table(summaryData);
    process.exit(0);
}

runDryRun().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
