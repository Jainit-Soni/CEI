const mongoose = require('mongoose');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

/**
 * Elite Fee Truth Dry-Run
 * =======================
 * Deterministic matching of official fees against the verified target.
 */

const TARGET_DB = process.env.MONGODB_URI + 'cei_v2';
const SOURCE_FILE = path.join(__dirname, '../data/truth/fees_truth.ndjson');
const REPORT_DIR = path.join(__dirname, '../reports/fees');

async function dryRun() {
    process.stdout.write('Starting Elite Fee Dry-Run...\n');
    
    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

    await mongoose.connect(TARGET_DB);
    const College = require('../models/CollegeSchema');

    const stats = {
        totalRows: 0,
        mapped: 0,
        unmapped: 0,
        conflicts: 0,
        coverageGain: 0
    };

    const candidates = [];
    const logs = [];

    const fileStream = fs.createReadStream(SOURCE_FILE);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        stats.totalRows++;
        const row = JSON.parse(line);

        // Deterministic Match Priority: Exact Name Match in CEI Registry
        // (Since fees_truth lacks AISHE, we use exact name as the bridge)
        const college = await College.findOne({ name: row.name });

        if (college) {
            stats.mapped++;
            
            const candidate = {
                id: college.id,
                aisheCode: college.aisheCode,
                name: college.name,
                feeUpdate: {
                    total: row.totalFee ? `₹${row.totalFee.toLocaleString()}` : null,
                    totalNumeric: row.totalFee,
                    tuition: row.tuition ? `₹${row.tuition.toLocaleString()}` : null,
                    hostelFees: row.hostelFees ? `₹${row.hostelFees.toLocaleString()}` : null,
                    source: row.source,
                    session: row.session || '2024-25',
                    isVerified: true
                },
                provenance: {
                    sourceFile: 'fees_truth.ndjson',
                    matchedBy: 'exact_name',
                    timestamp: new Date().toISOString()
                }
            };

            // Check for conflict (existing verified fee)
            if (college.fees && college.fees.isVerified && college.fees.totalNumeric !== row.totalFee) {
                stats.conflicts++;
                logs.push(`[CONFLICT] ${college.name}: Existing ${college.fees.totalNumeric} vs New ${row.totalFee}`);
            } else {
                candidates.push(candidate);
                if (!college.fees || !college.fees.totalNumeric) stats.coverageGain++;
            }
        } else {
            stats.unmapped++;
            logs.push(`[UNMAPPED] ${row.name}`);
        }
    }

    // Save outputs
    fs.writeFileSync(path.join(REPORT_DIR, 'elite_fee_mapping_summary.json'), JSON.stringify({ stats, logs }, null, 2));
    fs.writeFileSync(path.join(REPORT_DIR, 'elite_fee_dry_run_candidates.ndjson'), candidates.map(c => JSON.stringify(c)).join('\n'));

    // Generate MD Summary
    let md = `# Elite Fee Mapping Summary\n\n`;
    md += `## Stats\n\n`;
    md += `- **Total Rows Analyzed:** ${stats.totalRows}\n`;
    md += `- **Deterministically Mapped:** ${stats.mapped}\n`;
    md += `- **Unmapped (Missing in DB):** ${stats.unmapped}\n`;
    md += `- **Conflicts Detected:** ${stats.conflicts}\n`;
    md += `- **Net Coverage Gain:** +${stats.coverageGain} Institutions\n\n`;

    md += `## Sample Candidates\n\n| ID | Name | Fee (Total) | Source |\n|---|---|---|---|\n`;
    candidates.slice(0, 10).forEach(c => {
        md += `| ${c.id} | ${c.name} | ${c.feeUpdate.total} | ${c.feeUpdate.source} |\n`;
    });

    md += `\n## Risk Assessment\n\n`;
    if (stats.conflicts > 0) {
        md += `> [!WARNING]\n> ${stats.conflicts} conflicts found. Pre-existing verified fees exist for these institutions. Manual review recommended.\n\n`;
    } else {
        md += `> [!TIP]\n> No conflicts found. Mappings are non-destructive and safe for ingestion.\n\n`;
    }

    if (stats.unmapped > 0) {
        md += `> [!NOTE]\n> ${stats.unmapped} rows could not be deterministically mapped by name. Candidates for Tier 2 Fuzzy Matching.\n`;
    }

    fs.writeFileSync(path.join(REPORT_DIR, 'elite_fee_mapping_summary.md'), md);
    
    await mongoose.connection.close();
    console.log('Dry-Run Complete. Reports saved to backend/reports/fees/');
}

dryRun().catch(console.error);
