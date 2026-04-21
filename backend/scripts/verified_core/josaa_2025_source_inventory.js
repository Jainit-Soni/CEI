const fs = require('fs');
const path = require('path');
const readline = require('readline');

const searchDirs = [
    path.join(__dirname, '../../data'),
    path.join(__dirname, '../../data/truth'),
    path.join(__dirname, '../../data/truth/linked'),
    path.join(__dirname, '../../../Apify'),
];

async function inspectFile(filePath) {
    const stats = fs.statSync(filePath);
    if (stats.size < 10) return null; // empty or junk
    
    // Read first few lines
    const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
    let lines = [];
    let count = 0;
    for await (const line of rl) {
        lines.push(line);
        if (++count >= 10) break;
    }
    rl.close();

    const content = lines.join('\n');
    const isJson = filePath.endsWith('.json') || filePath.endsWith('.ndjson');
    const isCsv = filePath.endsWith('.csv');

    // Heuristics for Metadata
    const yearMatch = content.match(/202[45]/);
    const year = yearMatch ? yearMatch[0] : "Unknown";
    const authority = content.includes('JoSAA') ? 'JoSAA' : (content.includes('CSAB') ? 'CSAB' : (content.includes('ACPC') ? 'ACPC' : 'Unknown'));
    
    const hasSeats = content.toLowerCase().includes('seat') || content.toLowerCase().includes('intake') || content.toLowerCase().includes('open');
    const hasCutoffs = content.toLowerCase().includes('rank') || content.toLowerCase().includes('cutoff') || content.toLowerCase().includes('opening') || content.toLowerCase().includes('closing');
    const rounds = content.match(/Round\s*[0-9]/i) || content.match(/"round":\s*"?[0-9]"?/i);
    const hasInstitutions = content.toLowerCase().includes('institute') || content.toLowerCase().includes('college');

    let provenance = "Unclear";
    if (content.includes('Joint Seat Allocation Authority') || content.includes('JoSAA 202')) provenance = "High (Official Authority Marker)";
    if (content.includes('ACPC') && content.includes('Gujarat')) provenance = "High (Official ACPC Gujarat)";

    return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        year,
        authority,
        hasSeats,
        hasCutoffs,
        rounds: !!rounds,
        hasInstitutions,
        provenance,
        typeHint: isJson ? 'JSON/NDJSON' : (isCsv ? 'CSV' : 'Other')
    };
}

async function runInventory() {
    console.log("Starting Source Inventory...");
    const results = [];
    
    function walk(dir) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                if (file !== 'node_modules' && file !== '.git') walk(fullPath);
            } else {
                if (file.match(/\.(csv|json|ndjson|txt)$/i)) {
                    results.push(fullPath);
                }
            }
        }
    }

    searchDirs.forEach(walk);
    
    const findings = [];
    for (const f of results) {
        const info = await inspectFile(f);
        if (info && (info.year === '2025' || info.authority !== 'Unknown')) {
            findings.push(info);
        }
    }

    const reportPath = path.join(__dirname, '../../reports/verified_core/josaa_csab_2025_source_inventory.md');
    const jsonPath = path.join(__dirname, '../../reports/verified_core/josaa_csab_2025_source_inventory.json');

    fs.writeFileSync(jsonPath, JSON.stringify(findings, null, 2));

    const josaa2025 = findings.filter(f => f.year === '2025' && f.authority === 'JoSAA');
    const csab2025 = findings.filter(f => f.year === '2025' && f.authority === 'CSAB');

    let md = `# JoSAA/CSAB 2025 Source Inventory Report\n\n`;
    
    if (findings.length === 0) {
        md += `> [!CAUTION]\n> **Source missing: cannot continue deterministic 2025 dry-run**\n\nNo official 2025 JoSAA/CSAB artifacts were detected in the inspected directories.\n`;
    } else {
        md += `## Candidate 2025 JoSAA/CSAB Artifacts\n\n`;
        findings.forEach(f => {
            md += `### ${f.name}\n`;
            md += `- **Path**: \`${f.path}\`\n`;
            md += `- **Year**: ${f.year}\n`;
            md += `- **Authority**: ${f.authority}\n`;
            md += `- **Type**: ${f.hasSeats ? 'Seats ' : ''}${f.hasCutoffs ? 'Cutoffs ' : ''}\n`;
            md += `- **Rounds/Categories**: ${f.rounds ? 'Detected' : 'Not explicitly detected in header'}\n`;
            md += `- **Institution Names**: ${f.hasInstitutions ? 'Present' : 'Missing'}\n`;
            md += `- **Provenance**: ${f.provenance}\n\n`;
        });
    }

    fs.writeFileSync(reportPath, md);
    console.log(`Inventory complete. Found ${findings.length} potential artifacts.`);
    
    if (josaa2025.length === 0 && csab2025.length === 0) {
        console.log("CRITICAL: No Official 2025 JoSAA/CSAB artifacts found.");
    }
    
    process.exit(0);
}

runInventory().catch(console.error);
