const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const outputDir = path.join(__dirname, '../reports/audit');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Helper writers
const writeJson = (file, data) => fs.writeFileSync(path.join(outputDir, file), JSON.stringify(data, null, 2));
const writeMd = (file, content) => fs.writeFileSync(path.join(outputDir, file), content.trim());
const appendNdjson = (file, record) => fs.appendFileSync(path.join(outputDir, file), JSON.stringify(record) + '\n');
const appendCsv = (file, line) => fs.appendFileSync(path.join(outputDir, file), line + '\n');

function cleanCsv(str) {
    if (!str) return '""';
    return `"${String(str).replace(/"/g, '""')}"`;
}

// Heuristics for frontend visibility guess
function guessFrontendVisibility(layer, data) {
    if (!data) return false;
    if (layer === 'fees') {
        return !!data.totalNumeric || !!data.total; 
    }
    if (layer === 'placements') {
        const p = data;
        return p && (p.highest || p.median || p.average);
    }
    if (layer === 'rankings') {
        return Array.isArray(data) && data.length > 0;
    }
    return false;
}

async function runAudit() {
    console.log("Connecting to CEI_v2...");
    await mongoose.connect(process.env.MONGODB_URI + 'cei_v2');
    const College = require('../models/CollegeSchema');

    // Clean previous row-level files
    const matrixCsvOut = path.join(outputDir, 'college_data_matrix.csv');
    const matrixNdjsonOut = path.join(outputDir, 'college_data_matrix.ndjson');
    if (fs.existsSync(matrixCsvOut)) fs.unlinkSync(matrixCsvOut);
    if (fs.existsSync(matrixNdjsonOut)) fs.unlinkSync(matrixNdjsonOut);

    const csvHeaders = ["id", "stableKey", "name", "state", "city", "aisheCode", "website_present", "courses_present", "fees_present", "fees_verified", "rankings_present", "placements_present", "seats_present", "cutoffs_present", "source_metadata_present", "truth_grade", "frontend_fee_visible", "frontend_placement_visible", "frontend_ranking_visible", "num_courses", "num_rankings", "num_placement_fields", "num_fee_fields", "num_cutoffs", "num_seats"].join(',');
    appendCsv('college_data_matrix.csv', csvHeaders);

    // Tracking states
    const phaseA = {
        total: 0,
        byState: {},
        byType: {},
        hasAishe: 0,
        hasWebsite: 0,
        hasStableKey: 0,
        hasState: 0,
        hasCity: 0
    };

    const phaseB = {
        fees: { present: 0 },
        rankings: { present: 0 },
        placements: { present: 0 },
        seats: { present: 0 },
        courses: { present: 0 },
        cutoffs: { present: 0 },
        source_metadata: { present: 0 }
    };

    const phaseD = {
        coreInstitutions: []
    };

    const phaseE = {
        fees: { official_verified: 0, derived_deterministic: 0, legacy: 0, estimated: 0, unavailable: 0 },
        placements: { official_verified: 0, derived_deterministic: 0, legacy: 0, estimated: 0, unavailable: 0 },
        rankings: { official_verified: 0, derived_deterministic: 0, legacy: 0, estimated: 0, unavailable: 0 },
    };

    console.log("Starting full database cursor...");
    const cursor = College.find().lean().cursor({ batchSize: 5000 });

    for await (const c of cursor) {
        phaseA.total++;

        // Identity
        const state = c.state || "Unknown";
        phaseA.byState[state] = (phaseA.byState[state] || 0) + 1;
        const type = c.type || "Unknown";
        phaseA.byType[type] = (phaseA.byType[type] || 0) + 1;

        if (c.aisheCode) phaseA.hasAishe++;
        if (c.website) phaseA.hasWebsite++;
        if (c.stableKey) phaseA.hasStableKey++;
        if (c.state) phaseA.hasState++;
        if (c.city) phaseA.hasCity++;

        // Presence & Counts
        const c_courses = c.courses ? c.courses.length : 0;
        const c_ranks = c.rankings ? c.rankings.length : 0;
        const c_cutoffs = c.cutoffs ? c.cutoffs.length : 0;
        const c_seats = c.seats ? c.seats.length : 0;
        const c_placements = c.placements ? Object.keys(c.placements).filter(k => c.placements[k] !== null).length : 0;
        const c_fees = c.fees ? Object.keys(c.fees).length : 0;

        const has_courses = c_courses > 0;
        const has_ranks = c_ranks > 0;
        const has_cutoffs = c_cutoffs > 0;
        const has_seats = c_seats > 0;
        const has_placements = c_placements > 0;
        const has_fees = c_fees > 0;
        const has_meta = !!c.meta;

        if (has_fees) phaseB.fees.present++;
        if (has_ranks) phaseB.rankings.present++;
        if (has_placements) phaseB.placements.present++;
        if (has_seats) phaseB.seats.present++;
        if (has_courses) phaseB.courses.present++;
        if (has_cutoffs) phaseB.cutoffs.present++;
        if (has_meta) phaseB.source_metadata.present++;

        // Source Quality Tracking (Phase E)
        let feeGrade = 'unavailable';
        if (has_fees) {
            if (c.fees.isVerified === true && c.fees.matchBasis && c.fees.matchBasis.includes('official')) {
                feeGrade = 'official_verified';
            } else if (c.fees.bridgeStatus && c.fees.bridgeStatus.includes('deterministic')) {
                feeGrade = 'derived_deterministic';
            } else if (c.fees.isVerified === true) {
                feeGrade = 'official_verified'; // Assume true is official for now
            } else {
                feeGrade = 'legacy';
            }
        }
        phaseE.fees[feeGrade] = (phaseE.fees[feeGrade] || 0) + 1;

        let rankGrade = has_ranks ? 'official_verified' : 'unavailable'; // Assuming NIRF is official
        phaseE.rankings[rankGrade] = (phaseE.rankings[rankGrade] || 0) + 1;

        let placeGrade = has_placements ? (c.placements.isVerified ? 'official_verified' : 'legacy') : 'unavailable';
        phaseE.placements[placeGrade] = (phaseE.placements[placeGrade] || 0) + 1;

        // Frontend logic
        const f_fee = guessFrontendVisibility('fees', c.fees);
        const f_rank = guessFrontendVisibility('rankings', c.rankings);
        const f_place = guessFrontendVisibility('placements', c.placements);

        // Matrix
        const matrixRow = {
            id: c.id,
            stableKey: c.stableKey,
            name: c.name,
            state: c.state,
            city: c.city,
            aisheCode: c.aisheCode,
            website_present: !!c.website,
            courses_present: has_courses,
            fees_present: has_fees,
            fees_verified: !!(c.fees && c.fees.isVerified),
            rankings_present: has_ranks,
            placements_present: has_placements,
            seats_present: has_seats,
            cutoffs_present: has_cutoffs,
            source_metadata_present: has_meta,
            truth_grade: feeGrade,
            frontend_fee_visible: f_fee,
            frontend_placement_visible: f_place,
            frontend_ranking_visible: f_rank,
            num_courses: c_courses,
            num_rankings: c_ranks,
            num_placement_fields: c_placements,
            num_fee_fields: c_fees,
            num_cutoffs: c_cutoffs,
            num_seats: c_seats
        };
        appendNdjson('college_data_matrix.ndjson', matrixRow);

        const csvArr = [
            matrixRow.id, matrixRow.stableKey, matrixRow.name, matrixRow.state, matrixRow.city, matrixRow.aisheCode,
            matrixRow.website_present, matrixRow.courses_present, matrixRow.fees_present, matrixRow.fees_verified,
            matrixRow.rankings_present, matrixRow.placements_present, matrixRow.seats_present, matrixRow.cutoffs_present,
            matrixRow.source_metadata_present, matrixRow.truth_grade,
            matrixRow.frontend_fee_visible, matrixRow.frontend_placement_visible, matrixRow.frontend_ranking_visible,
            matrixRow.num_courses, matrixRow.num_rankings, matrixRow.num_placement_fields, matrixRow.num_fee_fields,
            matrixRow.num_cutoffs, matrixRow.num_seats
        ];
        appendCsv('college_data_matrix.csv', csvArr.map(cleanCsv).join(','));

        // Core Institutions (Phase D)
        const isCoreRule = c.isCore || /IIT |NIT |IIIT |IIM |AIIMS |.BITS |Institute of Technology/i.test(c.name);
        // Let's refine it heavily: IITs, NITs, IIMs, AIIMS, IIITs.
        const preciseCoreRule = /Indian Institute of Technology|National Institute of Technology|Indian Institute of Information Technology|Indian Institute of Management|All India Institute of Medical Sciences|Birla Institute of Technology/i.test(c.name);
        
        if (preciseCoreRule || c.isCore) {
            let nextRec = 'None';
            if (!f_fee) nextRec = 'Official Institute Website Fee Scraping';
            else if (!f_place) nextRec = 'NIRF Placement Extraction';
            else if (!has_seats) nextRec = 'JoSAA Seat Matrix Ingestion';

            phaseD.coreInstitutions.push({
                id: c.id,
                name: c.name,
                hasFees: has_fees,
                hasPlacements: has_placements,
                hasRankings: has_ranks,
                hasLoc: !!c.city,
                dataTierStatus: feeGrade,
                recommendedNextSourceFix: nextRec
            });
        }
    }

    console.log("Cursor finished. Generating reports...");

    // Phase A Report
    writeJson('full_registry_summary.json', phaseA);
    writeMd('full_registry_summary.md', `# CEI Database Registry Summary
**Total Colleges Audited:** ${phaseA.total}

### Identifiers Presence
- **AISHE Code:** ${phaseA.hasAishe} (${(phaseA.hasAishe/phaseA.total*100).toFixed(2)}%)
- **StableKey:** ${phaseA.hasStableKey} (${(phaseA.hasStableKey/phaseA.total*100).toFixed(2)}%)
- **Website:** ${phaseA.hasWebsite}
- **State:** ${phaseA.hasState}
- **City:** ${phaseA.hasCity}
`);

    // Phase B Report
    const bReport = {
        fees: { present: phaseB.fees.present, missing: phaseA.total - phaseB.fees.present, coverage: (phaseB.fees.present / phaseA.total * 100).toFixed(2) },
        rankings: { present: phaseB.rankings.present, missing: phaseA.total - phaseB.rankings.present, coverage: (phaseB.rankings.present / phaseA.total * 100).toFixed(2) },
        placements: { present: phaseB.placements.present, missing: phaseA.total - phaseB.placements.present, coverage: (phaseB.placements.present / phaseA.total * 100).toFixed(2) },
        seats: { present: phaseB.seats.present, missing: phaseA.total - phaseB.seats.present, coverage: (phaseB.seats.present / phaseA.total * 100).toFixed(2) },
        courses: { present: phaseB.courses.present, missing: phaseA.total - phaseB.courses.present, coverage: (phaseB.courses.present / phaseA.total * 100).toFixed(2) },
        cutoffs: { present: phaseB.cutoffs.present, missing: phaseA.total - phaseB.cutoffs.present, coverage: (phaseB.cutoffs.present / phaseA.total * 100).toFixed(2) },
        source_metadata: { present: phaseB.source_metadata.present, missing: phaseA.total - phaseB.source_metadata.present, coverage: (phaseB.source_metadata.present / phaseA.total * 100).toFixed(2) }
    };
    writeJson('field_coverage_summary.json', bReport);
    writeMd('field_coverage_summary.md', `# Field Coverage Summary\n\n` + Object.keys(bReport).map(k => `- **${k.toUpperCase()}**: ${bReport[k].coverage}% (${bReport[k].present}/${phaseA.total})`).join('\n'));

    // Phase D Report
    writeJson('core_institutions_gap_report.json', phaseD);
    const brokenCores = phaseD.coreInstitutions.filter(c => c.recommendedNextSourceFix !== 'None');
    writeMd('core_institutions_gap_report.md', `# Core Institutions Gap Report
Total Major Elite Institutions Found: ${phaseD.coreInstitutions.length}
Total Institutions Requesting Immediate Ingestion: ${brokenCores.length}

*Sample Prioritized Gaps:*
${brokenCores.slice(0,10).map(c => `- **${c.name}** [${c.id}] => Next Action: ${c.recommendedNextSourceFix} (Fees: ${c.hasFees}, Place: ${c.hasPlacements})`).join("\n")}
`);

    // Phase E Report
    writeJson('source_quality_summary.json', phaseE);
    writeMd('source_quality_summary.md', `# Source Quality Audit\n\n### Fees Layer\n- Official Verified: ${phaseE.fees.official_verified}\n- Derived: ${phaseE.fees.derived_deterministic}\n- Legacy: ${phaseE.fees.legacy}\n- Unavailable: ${phaseE.fees.unavailable}\n\n### Placement Layer\n- Official Verified: ${phaseE.placements.official_verified}\n- Legacy: ${phaseE.placements.legacy}\n- Unavailable: ${phaseE.placements.unavailable}`);

    // Phase F Report
    writeMd('frontend_visibility_audit.md', `# Frontend & API Visibility Audit
*Note*: This determines if structural components inside data shapes meet minimal thresholds to be passed directly to the React components.

- **Fees Visibility Estimates**: The \`/truth/fees\` contract guarantees exposure if \`isVerified\` OR \`bridgeStatus\` propagates and \`totalNumeric\` is present.
- **Rankings Visibility Estimates**: The NIRF and overall vault expects Array lengths > 0.
- **Placements Visibility Estimates**: Demands numerical averages/highest.

Check the row-level data matrix CSV to isolate any gaps between \`present\` and \`visible\`.
`);

    // Phase G Report
    // Priority queue logically deduces what the database needs right now.
    const priorityQueue = [
        { priority: 1, target: "Core Institutes Seat Matrices", rationale: "JoSAA/CSAB verified intake numbers map deterministically.", missingEntitiesCount: phaseA.total - phaseB.seats.present },
        { priority: 2, target: "National State-Level Fee Dumps (Official identifiers)", rationale: "Maharashtra pipeline proved capability; requires raw AISHE crosswalk table to leapfrog coverage safely.", missingEntitiesCount: phaseA.total - phaseB.fees.present },
        { priority: 3, target: "NIRF Placements Extension", rationale: "Extending NIRF derived placement statistics to all participating universities, beyond core IIT/NIT.", missingEntitiesCount: phaseA.total - phaseB.placements.present }
    ];
    writeJson('missing_data_priority_queue.json', priorityQueue);
    writeMd('missing_data_priority_queue.md', `# Missing Data Priority Queue\n\n1. **${priorityQueue[0].target}** (${priorityQueue[0].rationale})\n2. **${priorityQueue[1].target}** (${priorityQueue[1].rationale})\n3. **${priorityQueue[2].target}** (${priorityQueue[2].rationale})`);

    console.log("Complete.");
    process.exit(0);
}

runAudit().catch(console.error);
