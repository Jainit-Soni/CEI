const fs = require('fs');
const readline = require('readline');
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const sourceFile = path.join(__dirname, '../data/truth/maharashtra_fra_2024.ndjson');
const mappingsDir = path.join(__dirname, '../data/mappings');
const candidatesOut = path.join(__dirname, '../reports/fees/maharashtra_dte_bridge_candidates.ndjson');
const summaryJsonOut = path.join(__dirname, '../reports/fees/maharashtra_dte_bridge_mapping_summary.json');
const summaryMdOut = path.join(__dirname, '../reports/fees/maharashtra_dte_bridge_mapping_summary.md');

// Ensure mappings directory exists
if (!fs.existsSync(mappingsDir)) {
    fs.mkdirSync(mappingsDir, { recursive: true });
}

// Strict Rule-Based Normalizer
function normalizeInstituteName(name) {
    if (!name) return "";
    
    let norm = name.toUpperCase();
    
    // Expand common DTE shorthand
    const expansions = {
        ' COLL ': ' COLLEGE ',
        ' COLL.': ' COLLEGE ',
        ' ENGG ': ' ENGINEERING ',
        ' ENGG.': ' ENGINEERING ',
        ' TECH ': ' TECHNOLOGY ',
        ' TECH.': ' TECHNOLOGY ',
        ' MGMT ': ' MANAGEMENT ',
        ' MGMT.': ' MANAGEMENT ',
        ' INST ': ' INSTITUTE ',
        ' INST.': ' INSTITUTE ',
        ' RES ': ' RESEARCH ',
        ' RES.': ' RESEARCH ',
        ' PHARM ': ' PHARMACY ',
        ' PHARM.': ' PHARMACY ',
        ' EDU ': ' EDUCATION ',
        ' EDU.': ' EDUCATION ',
        '&': ' AND '
    };

    // Pad with spaces for word boundary matching
    norm = ' ' + norm + ' ';
    for (const [key, value] of Object.entries(expansions)) {
        norm = norm.split(key).join(value);
    }

    // Remove common non-differentiating titles that often mismatch
    const titlesToRemove = ['SHRI ', 'DR. ', 'DR ', 'PROF. ', 'PROF ', 'LATE ', 'SHRIMATI ', 'SMT ', 'SMT. ', 'KM ', 'KUM '];
    for (const title of titlesToRemove) {
        norm = norm.replace(new RegExp(`\\b${title.trim()}\\b`, 'g'), '');
    }

    // Strip all non-alphanumeric characters, including spaces
    norm = norm.replace(/[^A-Z0-9]/g, '');

    return norm;
}

async function runBridgeBuilder() {
    console.log("Connecting to CEI Database...");
    await mongoose.connect(process.env.MONGODB_URI + 'cei_v2');
    const College = require('../models/CollegeSchema');

    console.log("Fetching all Maharashtra colleges for normalization space...");
    const dbColleges = await College.find({ state: /Maharashtra/i }).select('id name aisheCode district fees isPremium isCore stableKey').lean();
    
    // Build lookup table keyed by normalized name
    const collegeSpace = new Map();
    for (const c of dbColleges) {
        const nName = normalizeInstituteName(c.name);
        if (!nName) continue;
        
        if (!collegeSpace.has(nName)) {
            collegeSpace.set(nName, []);
        }
        collegeSpace.get(nName).push(c);
    }

    let totalRows = 0;
    const bridgeCandidates = [];
    let counts = {
        deterministic_verified: 0,
        blocked_conflict: 0,
        unresolved: 0
    };

    const fileStream = fs.createReadStream(sourceFile);
    const rl = readline.createInterface({ input: fileStream });

    console.log("Starting strict rule-based name deterministic bridging...");

    for await (const line of rl) {
        if (!line.trim()) continue;
        totalRows++;
        
        try {
            const row = JSON.parse(line);
            const nSourceName = normalizeInstituteName(row.name);
            const matches = collegeSpace.get(nSourceName) || [];

            const candidate = {
                dteCode: row.collegeId,
                instituteNameOfficial: row.name,
                tuitionFeeTarget: row.tuitionFee,
                totalFeeTarget: row.totalFee,
                matchBasis: null,
                bridgeEvidence: null,
                statusBucket: null
            };

            if (matches.length === 1) {
                const dbMatch = matches[0];
                candidate.statusBucket = 'deterministic_verified';
                candidate.matchBasis = 'strict_normalization_rule';
                candidate.bridgeEvidence = {
                    normalizedString: nSourceName,
                    matchedDbName: dbMatch.name,
                    aisheCode: dbMatch.aisheCode,
                    ceiCollegeId: dbMatch.id,
                    dbDistrict: dbMatch.district
                };
                counts.deterministic_verified++;
            } else if (matches.length > 1) {
                candidate.statusBucket = 'blocked_conflict';
                candidate.matchBasis = 'multiple_collisions';
                candidate.bridgeEvidence = {
                    normalizedString: nSourceName,
                    collisionCount: matches.length,
                    collidingIds: matches.map(m => m.id)
                };
                counts.blocked_conflict++;
            } else {
                candidate.statusBucket = 'unresolved';
                candidate.matchBasis = 'no_exact_match';
                candidate.bridgeEvidence = {
                    normalizedString: nSourceName
                };
                counts.unresolved++;
            }

            bridgeCandidates.push(candidate);
        } catch (e) {
            console.error("Error parsing row:", e.message);
        }
    }

    // Write Candidates NDJSON synchronously to ensure completion
    const outData = bridgeCandidates.map(c => JSON.stringify(c)).join('\n');
    fs.writeFileSync(candidatesOut, outData + '\n');

    const verifiedPercentage = totalRows > 0 ? ((counts.deterministic_verified / totalRows) * 100).toFixed(2) : 0;

    const summaryData = {
        totalTargetCandidates: totalRows,
        ...counts,
        percentageMatched: verifiedPercentage + "%",
        policyApplied: "strict_rule_based_normalization_no_fuzzy"
    };
    
    fs.writeFileSync(summaryJsonOut, JSON.stringify(summaryData, null, 2));

    const mdReport = `# Official DTE Bridge Construction Summary (Fallback Strategy)

## Bridge Construction Policy
Pursuant to strict constraints, since no raw official DTE Master List CSV was natively present, a **strict rule-based generator** was employed. 

- **Fuzzy matching**: Strictly disabled.
- **Rules applied**: Exact string matching after strict uppercase conversion, expansion of official DTE domain abbreviations (\`COLL\`, \`ENGG\`, \`MGMT\`, etc.), safe prefix stripping, and precise alphanumeric isolation.

## Bridge Yield
- **Target FRA Rows Analyzed**: ${totalRows}
- **\`deterministic_verified\`**: ${counts.deterministic_verified} (${verifiedPercentage}%)
- **\`blocked_conflict\`**: ${counts.blocked_conflict} (Multiple campus identical-name collision)
- **\`unresolved\`**: ${counts.unresolved} (Requires literal manual verification or exact code mapping list)

## Output Schema
The generated bridging ledger (\`maharashtra_dte_bridge_candidates.ndjson\`) contains:
- \`dteCode\` (EN/PH/AR source)
- \`instituteNameOfficial\` (Original FRA name)
- \`statusBucket\` (Only verified rows are candidates for the next live ingest phase)
- \`bridgeEvidence\` (Includes \`aisheCode\`, \`ceiCollegeId\`, and normalization logic footprint)

### Operational Check
**CAUTION**: Do NOT trigger Maharashtra FRA live ingestion across the \`blocked_conflict\` or \`unresolved\` arrays. Only promote the \`deterministic_verified\` slice directly to the \`cei_v2\` MongoDB.
`;

    fs.writeFileSync(summaryMdOut, mdReport);

    console.log("Bridge construction complete. Outputs generated in backend/reports/fees/");
    console.table(summaryData);
    process.exit(0);
}

runBridgeBuilder().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
