const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

/**
 * DB Target Verification Script
 * ============================
 * Forensic analysis of available environment files to identify the
 * active CEI Source of Truth.
 */

const ENV_FILES = ['.env.local', '.env.production', '.env'];
const GOLD_STANDARDS = [
    'Indian Institute of Technology Madras',
    'Indian Institute of Technology Delhi',
    'Indian Institute of Technology Bombay',
    'Indian Institute of Technology Kanpur',
    'Indian Institute of Technology Kharagpur'
];

async function verifyEnvironment(envFile) {
    const envPath = path.join(__dirname, '..', envFile);
    if (!fs.existsSync(envPath)) return null;

    // Load env without polluting current process.env permanently
    const config = dotenv.parse(fs.readFileSync(envPath));
    const uri = config.MONGODB_URI;

    if (!uri) return { file: envFile, status: 'error', reason: 'Missing MONGODB_URI' };

    try {
        const connection = await mongoose.createConnection(uri).asPromise();
        const College = connection.model('College', require('../models/CollegeSchema').schema);

        const count = await College.countDocuments();
        const matches = await College.find({ 
            name: { $in: GOLD_STANDARDS } 
        }).select('id name state aisheCode stableKey');

        await connection.close();

        return {
            file: envFile,
            status: 'success',
            uriMasked: uri.split('@')[1] || 'hidden',
            totalDocuments: count,
            goldMatches: matches.length,
            samples: matches.map(m => ({
                id: m.id,
                aisheCode: m.aisheCode,
                name: m.name,
                state: m.state,
                stableKey: m.stableKey
            }))
        };
    } catch (err) {
        return { file: envFile, status: 'error', reason: err.message };
    }
}

async function run() {
    process.stdout.write('Starting DB Target Verification...\n');
    const results = [];

    for (const file of ENV_FILES) {
        process.stdout.write(`Checking ${file}...\n`);
        const res = await verifyEnvironment(file);
        if (res) results.push(res);
    }

    const reportPath = path.join(__dirname, '..', 'reports', 'fees');
    if (!fs.existsSync(reportPath)) fs.mkdirSync(reportPath, { recursive: true });

    fs.writeFileSync(
        path.join(reportPath, 'db_target_verification.json'),
        JSON.stringify(results, null, 2)
    );

    // Generate MD Report
    let md = `# DB Target Verification Report\n\nGenerated at: ${new Date().toISOString()}\n\n`;
    
    results.forEach(res => {
        md += `## File: \`${res.file}\`\n`;
        if (res.status === 'error') {
            md += `> [!CAUTION]\n> Connection failed: ${res.reason}\n\n`;
        } else {
            md += `- **Status:** REACHABLE\n`;
            md += `- **Total Documents:** ${res.totalDocuments.toLocaleString()}\n`;
            md += `- **Gold Standard Matches:** ${res.goldMatches} / ${GOLD_STANDARDS.length}\n`;
            md += `- **Host:** \`${res.uriMasked}\`\n\n`;
            
            if (res.samples && res.samples.length > 0) {
                md += `### Samples Found\n\n| ID | Name | State | AISHE |\n|---|---|---|---|\n`;
                res.samples.forEach(s => {
                    md += `| ${s.id} | ${s.name} | ${s.state} | ${s.aisheCode || 'N/A'} |\n`;
                });
                md += '\n';
            }
        }
        md += '---\n\n';
    });

    // Strategy Determination
    const winner = results.find(r => r.totalDocuments > 50000);
    md += `## Final Decision\n\n`;
    if (winner) {
        md += `> [!IMPORTANT]\n> **Target Verified:** \`${winner.file}\` is the primary SSoT with ${winner.totalDocuments.toLocaleString()} records.\n\n`;
        md += `Incoming truth ingestion (Fees) MUST use the connection string from \`${winner.file}\`.\n`;
    } else {
        md += `> [!WARNING]\n> **No clear target found.** No environment matches the expected production volume.\n`;
    }

    fs.writeFileSync(path.join(reportPath, 'db_target_verification.md'), md);
    console.log('Verification Complete. Report saved to backend/reports/fees/');
}

run().catch(console.error);
