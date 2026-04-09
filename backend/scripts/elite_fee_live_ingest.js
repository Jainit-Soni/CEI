const mongoose = require('mongoose');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

/**
 * Elite Fee Live Ingest Script
 * ===========================
 * Promotes 31 deterministic fee candidates into the cei_v2 database.
 * Includes before/after logging and auditing.
 */

const TARGET_DB = process.env.MONGODB_URI + 'cei_v2';
const CANDIDATE_FILE = path.join(__dirname, '../reports/fees/elite_fee_dry_run_candidates.ndjson');
const REPORT_DIR = path.join(__dirname, '../reports/fees');

async function ingest() {
    process.stdout.write('Starting Official Elite Fee Ingestion...\n');
    
    await mongoose.connect(TARGET_DB);
    const College = require('../models/CollegeSchema');

    const audit = {
        totalCandidates: 0,
        actuallyIngested: 0,
        skippedDueToStrength: 0,
        errors: 0,
        startTime: new Date().toISOString()
    };

    const ledger = [];
    const fileStream = fs.createReadStream(CANDIDATE_FILE);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        audit.totalCandidates++;
        const candidate = JSON.parse(line);

        try {
            const college = await College.findOne({ id: candidate.id });

            if (!college) {
                console.error(`[ERROR] College not found: ${candidate.id}`);
                audit.errors++;
                continue;
            }

            const before = JSON.parse(JSON.stringify(college.fees || {}));
            
            // Overwrite Policy: Force promote Official Elite Truth.
            // Even if existing data is verified, the Elite Truth layer represents 
            // the official authoritative 2024-25 cycle filings.
            const shouldPromote = true; 

            if (shouldPromote) {
                college.fees = {
                    ...candidate.feeUpdate,
                    promotedAt: new Date(),
                    matchBasis: 'deterministic_name_elite'
                };

                await college.save();
                audit.actuallyIngested++;

                ledger.push({
                    _id: college._id,
                    id: college.id,
                    name: college.name,
                    before,
                    after: college.fees,
                    timestamp: new Date().toISOString(),
                    mutation: 'UPDATE_FEES'
                });
            } else {
                audit.skippedDueToStrength++;
            }
        } catch (err) {
            console.error(`[CRITICAL] Failed to ingest ${candidate.id}: ${err.message}`);
            audit.errors++;
        }
    }

    // Save final reports
    fs.writeFileSync(path.join(REPORT_DIR, 'elite_fee_promotion_ledger.ndjson'), ledger.map(l => JSON.stringify(l)).join('\n'));
    fs.writeFileSync(path.join(REPORT_DIR, 'elite_fee_post_ingest_audit.json'), JSON.stringify(audit, null, 2));

    // Generate MD Summary
    let md = `# Elite Fee Post-Ingest Summary\n\n`;
    md += `## Ingestion Stats\n\n`;
    md += `- **Candidates Processed:** ${audit.totalCandidates}\n`;
    md += `- **Successful Promotions:** ${audit.actuallyIngested}\n`;
    md += `- **Skipped (Strong Data Protected):** ${audit.skippedDueToStrength}\n`;
    md += `- **Errors:** ${audit.errors}\n\n`;

    md += `## Coverage Impact\n\n`;
    md += `| Institution | New Fee (Total) | Status |\n|---|---|---|\n`;
    ledger.slice(0, 10).forEach(l => {
        md += `| ${l.name} | ${l.after.total} | ✅ Ingested |\n`;
    });

    fs.writeFileSync(path.join(REPORT_DIR, 'elite_fee_post_ingest_summary.md'), md);

    await mongoose.connection.close();
    console.log('Ingestion Complete. Ledger and Audit saved to backend/reports/fees/');
}

ingest().catch(console.error);
