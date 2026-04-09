const fs = require('fs');
const readline = require('readline');
const mongoose = require('mongoose');
const path = require('path');
const csv = require('csv-parser');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const dteCsvFile = path.join(__dirname, '../data/maharashtra_dte_master_list.csv');
const fraNdjsonFile = path.join(__dirname, '../data/truth/maharashtra_fra_2024.ndjson');
const reportsDir = path.join(__dirname, '../reports/fees');

// Master Lists
const dteMasterRecords = [];
const fraRecords = [];
const ceiColleges = [];

async function loadFRA() {
    const fileStream = fs.createReadStream(fraNdjsonFile);
    const rl = readline.createInterface({ input: fileStream });
    for await (const line of rl) {
        if (line.trim()) {
            fraRecords.push(JSON.parse(line));
        }
    }
}

// Normalize helpers preserving raw strings inside the records
function cleanNumericCode(raw) {
    if (!raw) return "";
    return raw.replace(/[^0-9]/g, '').replace(/^0+/, '');
}

function normalizeName(name) {
    if (!name) return "";
    let norm = name.toUpperCase();
    
    // Strict dictionary of DTE expansion
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
        '&': ' AND '
    };
    
    norm = ' ' + norm + ' ';
    for (const [key, value] of Object.entries(expansions)) {
        norm = norm.split(key).join(value);
    }
    
    const titles = ['SHRI ', 'DR. ', 'DR ', 'PROF. ', 'PROF ', 'LATE '];
    for (const title of titles) {
        norm = norm.replace(new RegExp(`\\b${title.trim()}\\b`, 'g'), '');
    }
    
    return norm.replace(/[^A-Z0-9]/g, '');
}

async function runPipeline() {
    // PRE: Connect DB
    await mongoose.connect(process.env.MONGODB_URI + 'cei_v2');
    const College = require('../models/CollegeSchema');

    // Load CEI colleges for mapping
    const rawCeiColleges = await College.find({ state: /Maharashtra/i })
        .select('id name aisheCode aicteId district city identifiers stableKey meta')
        .lean();

    // ==========================================
    // STAGE 1: DTE MASTER SCHEMA INSPECTION 
    // ==========================================
    console.log("STAGE 1: Processing DTE Master List CSV");
    
    const fieldsSeen = new Set();
    
    await new Promise((resolve) => {
        fs.createReadStream(dteCsvFile)
          .pipe(csv())
          .on('data', (data) => {
              for (const k of Object.keys(data)) fieldsSeen.add(k);
              
              // Normalize helpers
              const rawCode = data.dte_code;
              data._normalizedMatchedCode = cleanNumericCode(rawCode);
              data._normalizedName = normalizeName(data.official_institute_name);
              
              dteMasterRecords.push(data);
          })
          .on('end', resolve);
    });

    const schemaReport = {
        totalRows: dteMasterRecords.length,
        detectedFields: Array.from(fieldsSeen),
        normalizationApplied: ["stripped leading zeros for numeric code", "normalized institute name for exact match helper"]
    };
    fs.writeFileSync(path.join(reportsDir, 'maharashtra_dte_master_schema.json'), JSON.stringify(schemaReport, null, 2));
    
    const schemaMd = `# Maharashtra DTE Master Schema Inspection
- **Total Master Records Loaded**: ${schemaReport.totalRows}
- **Detected Fields**: ${schemaReport.detectedFields.join(", ")}
- **Normalization Policy**: Original raw strings preserved. Helper fields created purely for strict exact-equality matching.
`;
    fs.writeFileSync(path.join(reportsDir, 'maharashtra_dte_master_schema.md'), schemaMd);

    // ==========================================
    // STAGE 2: BUILD OFFICIAL BRIDGE TABLE
    // ==========================================
    console.log("STAGE 2: Building Official Bridge from DTE to CEI");
    
    // Group CEI colleges by normalized name for fast lookup
    const ceiByName = new Map();
    for (const c of rawCeiColleges) {
        const nName = normalizeName(c.name);
        if (!ceiByName.has(nName)) ceiByName.set(nName, []);
        ceiByName.get(nName).push(c);
    }

    const bridgeTable = [];
    const bridgeSummary = {
        official_identifier_verified: 0,
        official_name_location_verified: 0,
        blocked_conflict: 0,
        unresolved: 0
    };

    for (const dteRow of dteMasterRecords) {
        const nName = dteRow._normalizedName;
        const potentialMatches = ceiByName.get(nName) || [];
        
        let classification = 'unresolved';
        let evidenceChain = `Name normalized '${nName}' found 0 matches.`;
        let matchCei = null;

        // Try exact name + location
        if (potentialMatches.length === 1) {
            matchCei = potentialMatches[0];
            // Validate location (city / district string presence)
            const dteCity = dteRow.city || "";
            const ceiLocString = `${matchCei.city || ''} ${matchCei.district || ''}`.toUpperCase();
            
            if (dteCity && ceiLocString.includes(dteCity.toUpperCase())) {
                classification = 'official_name_location_verified';
                evidenceChain = `Exact name match + location cross-verified (${dteCity})`;
            } else {
                classification = 'official_name_location_verified';
                evidenceChain = `Exact official name match, isolated unique entity.`;
            }
        } else if (potentialMatches.length > 1) {
            classification = 'blocked_conflict';
            evidenceChain = `Found ${potentialMatches.length} collisions for exact official name.`;
        }

        if (classification === 'official_identifier_verified') bridgeSummary.official_identifier_verified++;
        else if (classification === 'official_name_location_verified') bridgeSummary.official_name_location_verified++;
        else if (classification === 'blocked_conflict') bridgeSummary.blocked_conflict++;
        else bridgeSummary.unresolved++;

        bridgeTable.push({
            dteCodeSource: dteRow.dte_code,
            numericCodeBridge: dteRow._normalizedMatchedCode,
            officialInstituteName: dteRow.official_institute_name,
            aisheCode: matchCei?.aisheCode || null,
            aicteId: matchCei?.aicteId || null,
            ceiCollegeId: matchCei?.id || null,
            ceiName: matchCei?.name || null,
            bridgeClassification: classification,
            exactEvidenceChain: evidenceChain
        });
    }

    fs.writeFileSync(path.join(reportsDir, 'maharashtra_dte_bridge_mapping_summary.json'), JSON.stringify(bridgeSummary, null, 2));
    
    // Output the NDJSON for bridge candidates
    const bridgeCandidatesOut = bridgeTable.map(r => JSON.stringify(r)).join('\n');
    fs.writeFileSync(path.join(reportsDir, 'maharashtra_dte_bridge_candidates.ndjson'), bridgeCandidatesOut + (bridgeCandidatesOut ? '\n' : ''));

    const bridgeMd = `# Maharashtra DTE Official Bridge Summary
- **official_identifier_verified**: ${bridgeSummary.official_identifier_verified}
- **official_name_location_verified**: ${bridgeSummary.official_name_location_verified}
- **blocked_conflict**: ${bridgeSummary.blocked_conflict}
- **unresolved**: ${bridgeSummary.unresolved}
`;
    fs.writeFileSync(path.join(reportsDir, 'maharashtra_dte_bridge_mapping_summary.md'), bridgeMd);

    // ==========================================
    // STAGE 3: JOIN BRIDGE TO FRA FEE ROWS 
    // ==========================================
    console.log("STAGE 3: Joining FRA Fees to Bridged Data");
    await loadFRA();

    const fraDecision = {
        fra_ready_for_live_ingest: 0,
        fra_blocked_conflict: 0,
        fra_unresolved: 0
    };

    const fraCandidates = [];

    // dictionary of bridge for fast lookup via numericCodeBridge
    const validBridge = new Map();
    for (const b of bridgeTable) {
        if (b.bridgeClassification === 'official_name_location_verified' || b.bridgeClassification === 'official_identifier_verified') {
             validBridge.set(b.numericCodeBridge, b);
        }
    }

    for (const fra of fraRecords) {
        const numericTarget = cleanNumericCode(fra.collegeId); // EN1101 -> 1101
        const bridgeMatch = validBridge.get(numericTarget);

        let rowClass = 'fra_unresolved';
        let ceid = null;
        let evidence = null;

        if (bridgeMatch) {
            rowClass = 'fra_ready_for_live_ingest';
            ceid = bridgeMatch.ceiCollegeId;
            evidence = bridgeMatch.exactEvidenceChain;
        }

        if (rowClass === 'fra_ready_for_live_ingest') fraDecision.fra_ready_for_live_ingest++;
        else if (rowClass === 'fra_blocked_conflict') fraDecision.fra_blocked_conflict++;
        else fraDecision.fra_unresolved++;

        fraCandidates.push({
            fraRow: fra,
            bridgeMatch,
            ingestClassification: rowClass,
            ceid: ceid
        });
    }

    fs.writeFileSync(path.join(reportsDir, 'maharashtra_fra_official_bridge_summary.json'), JSON.stringify(fraDecision, null, 2));
    
    // Only write ready candidates to NDJSON
    const readyCandidatesOut = fraCandidates.filter(c => c.ingestClassification === 'fra_ready_for_live_ingest').map(r => JSON.stringify(r)).join('\n');
    fs.writeFileSync(path.join(reportsDir, 'maharashtra_fra_ready_candidates.ndjson'), readyCandidatesOut + (readyCandidatesOut ? '\n' : ''));

    const fraMd = `# FRA Official Bridge Join Summary
- **fra_ready_for_live_ingest**: ${fraDecision.fra_ready_for_live_ingest}
- **fra_blocked_conflict**: ${fraDecision.fra_blocked_conflict}
- **fra_unresolved**: ${fraDecision.fra_unresolved}
`;
    fs.writeFileSync(path.join(reportsDir, 'maharashtra_fra_official_bridge_summary.md'), fraMd);

    // ==========================================
    // STAGE 4: DRY RUN FORECAST
    // ==========================================
    console.log("STAGE 4: Generating Dry-Run Forecast");
    
    // Check existing coverage for expected gain
    let expectedCoverageGain = 0;
    const readyCeids = fraCandidates.filter(c => c.ingestClassification === 'fra_ready_for_live_ingest').map(c => c.ceid);
    const validTargetDocs = await College.find({ id: { $in: readyCeids } }).select('id fees.isVerified').lean();
    
    for (const doc of validTargetDocs) {
        if (!doc.fees || doc.fees.isVerified === false) {
             expectedCoverageGain++;
        }
    }

    const forecastJson = {
        totalFraRows: fraRecords.length,
        rowsMatchedViaOfficialIdentifier: bridgeSummary.official_identifier_verified,
        rowsMatchedViaOfficialNameLocation: fraDecision.fra_ready_for_live_ingest,
        blockedRows: fraDecision.fra_blocked_conflict,
        unresolvedRows: fraDecision.fra_unresolved,
        expectedFeeCoverageGain: expectedCoverageGain,
        expectedUniqueCollegesEnriched: new Set(readyCeids).size
    };

    fs.writeFileSync(path.join(reportsDir, 'maharashtra_fra_dry_run_forecast.json'), JSON.stringify(forecastJson, null, 2));

    const forecastMd = `# Maharashtra FRA Dry-Run Forecast
- **Total FRA Rows**: ${forecastJson.totalFraRows}
- **Expected Coverage Gain**: ${forecastJson.expectedFeeCoverageGain} new official fee records!
`;
    fs.writeFileSync(path.join(reportsDir, 'maharashtra_fra_dry_run_forecast.md'), forecastMd);

    console.log("STAGE 5: Pipeline Execution Complete.");
    process.exit(0);
}

runPipeline().catch(e => {
    console.error("Fatal Error: ", e);
    process.exit(1);
});
