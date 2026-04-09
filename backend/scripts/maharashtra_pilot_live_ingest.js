const fs = require('fs');
const readline = require('readline');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const candidatesFile = path.join(__dirname, '../reports/fees/maharashtra_dte_bridge_candidates.ndjson');
const ledgerPath = path.join(__dirname, '../reports/fees/maharashtra_pilot_promotion_ledger.ndjson');

async function runPilotIngest() {
    console.log("Connecting to CEI_v2 Database for Pilot Ingest...");
    await mongoose.connect(process.env.MONGODB_URI + 'cei_v2');
    const College = require('../models/CollegeSchema');

    // Create tracking structures
    let totalProcessed = 0;
    let successfulPromotions = 0;
    let skippedProtected = 0;
    const ledger = [];

    const fileStream = fs.createReadStream(candidatesFile);
    const rl = readline.createInterface({ input: fileStream });

    console.log("Starting restricted pilot ingestion for DTE Bridge Candidates...");

    for await (const line of rl) {
        if (!line.trim()) continue;
        const candidate = JSON.parse(line);

        // ONLY ingest deterministic_verified candidates
        if (candidate.statusBucket !== 'deterministic_verified') {
            continue;
        }

        totalProcessed++;

        const collegeId = candidate.bridgeEvidence.ceiCollegeId || candidate.dteCode;
        const college = await College.findOne({ 
            $or: [
                { id: collegeId },
                { _id: mongoose.isValidObjectId(collegeId) ? collegeId : null },
                { stableKey: collegeId }
            ]
        });

        if (!college) {
            console.warn(`Target College ${collegeId} not found, skipping.`);
            continue;
        }

        // Before State for Ledger
        const beforeState = JSON.parse(JSON.stringify(college.fees || {}));

        // Policy: Do not overwrite stronger existing fee truth
        // An existing fee truth is stronger if it was explicitly flagged as fully verified (e.g., deterministic official or manual).
        // Since this is a "derived" pilot bridge layer, it shouldn't overwrite an absolute official layer.
        let skip = false;
        if (college.fees && typeof college.fees.isVerified === 'boolean') {
            // We only skip if it's already true, OR if the source is stronger.
            if (college.fees.isVerified && college.fees.matchBasis !== 'strict_normalization_rule') {
                skip = true;
                skippedProtected++;
            }
        }

        if (!skip) {
            const rawTuition = Number(candidate.tuitionFeeTarget);
            const rawTotal = Number(candidate.totalFeeTarget);

            // Construct new derived truth object
            college.fees = {
                total: `₹${rawTotal.toLocaleString()}`,
                totalNumeric: rawTotal,
                tuition: `₹${rawTuition.toLocaleString()}`,
                tuitionNumeric: rawTuition,
                source: "Maharashtra FRA 2024",
                session: "2024-25",
                isVerified: true, // It is a strict deterministic bridge
                promotedAt: new Date(),
                bridgeStatus: "derived_deterministic_name_match",
                bridgeSource: "maharashtra_fra_2024 + strict_rule_bridge",
                evidence: candidate.bridgeEvidence
            };

            await college.save();
            successfulPromotions++;

            ledger.push({
                operation: 'PROMOTED',
                timestamp: new Date(),
                collegeId: college.id,
                name: college.name,
                bridgeCandidateName: candidate.instituteNameOfficial,
                before: beforeState,
                after: college.fees
            });
        }
    }

    // Write Ledger
    if (fs.existsSync(ledgerPath)) fs.unlinkSync(ledgerPath);
    const ledgerStream = fs.createWriteStream(ledgerPath);
    for (const record of ledger) {
        ledgerStream.write(JSON.stringify(record) + "\n");
    }
    ledgerStream.end();

    console.log(`\n### Restricted Pilot Ingest Summary ###`);
    console.log(`- Deterministic Candidates Processed: ${totalProcessed}`);
    console.log(`- Successfully Promoted: ${successfulPromotions}`);
    console.log(`- Skipped (Stronger Truth Exists): ${skippedProtected}`);

    process.exit(0);
}

runPilotIngest().catch(err => {
    console.error("Fatal Error during ingest:", err);
    process.exit(1);
});
