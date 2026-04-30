const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * audit_excel_export.js
 * =======================
 * Truth-grade audit for CEI Excel exports.
 */

async function runAudit() {
    console.log("🔍 Initializing Truth-Grade Excel Audit...");

    const masterPath = path.join(__dirname, '../exports/colleges_master.xlsx');
    const deepPath = path.join(__dirname, '../exports/colleges_deep_truth.xlsx');

    if (!fs.existsSync(masterPath) || !fs.existsSync(deepPath)) {
        console.error("❌ Export files missing. Run export script first.");
        process.exit(1);
    }

    const report = {
        timestamp: new Date().toISOString(),
        master: {
            total_rows: 0,
            missing_ids: 0,
            duplicate_ids: 0,
            tier_mismatches: 0,
            tier_distribution: {},
            score_distribution: {},
            top_density_institutions: [],
            violations: []
        },
        deep: {
            total_rows: 0,
            missing_ids: 0,
            duplicate_fingerprints: 0,
            mixed_truth_rows: 0,
            empty_truth_rows: 0,
            domain_distribution: {},
            authority_distribution: {},
            confidence_distribution: {},
            institution_samples: {},
            violations: []
        },
        summary: {
            passed: false,
            checks: {}
        }
    };

    // --- 1. AUDIT MASTER FILE ---
    console.log("📂 Auditing colleges_master.xlsx...");
    const masterWB = XLSX.readFile(masterPath);
    const masterRows = XLSX.utils.sheet_to_json(masterWB.Sheets["Institutions"]);
    report.master.total_rows = masterRows.length;

    const masterIdMap = new Map();
    masterRows.forEach((row, i) => {
        const id = row.institution_id;
        const score = row.truth_completeness_score;
        const tier = row.truth_tier;

        if (!id) report.master.missing_ids++;
        if (masterIdMap.has(id)) report.master.duplicate_ids++;
        masterIdMap.set(id, true);

        // Tier distribution
        report.master.tier_distribution[tier] = (report.master.tier_distribution[tier] || 0) + 1;
        report.master.score_distribution[score] = (report.master.score_distribution[score] || 0) + 1;

        // Consistency check
        const expectedTier = ["E", "D", "C", "B", "A"][score];
        if (tier !== expectedTier) {
            report.master.tier_mismatches++;
            report.master.violations.push({ row: i + 2, id, reason: `Tier Mismatch: Score ${score} should be ${expectedTier}, found ${tier}` });
        }
    });

    report.master.top_density_institutions = masterRows
        .sort((a, b) => (b.total_cutoff_rows + b.total_seat_rows + b.total_medical_cutoff_rows + b.total_medical_seat_rows) - 
                        (a.total_cutoff_rows + a.total_seat_rows + a.total_medical_cutoff_rows + a.total_medical_seat_rows))
        .slice(0, 20)
        .map(r => ({ id: r.institution_id, name: r.name, total: r.total_cutoff_rows + r.total_seat_rows + r.total_medical_cutoff_rows + r.total_medical_seat_rows }));

    // --- 2. AUDIT DEEP TRUTH FILE ---
    console.log("📂 Auditing colleges_deep_truth.xlsx...");
    const deepWB = XLSX.readFile(deepPath);
    const deepRows = XLSX.utils.sheet_to_json(deepWB.Sheets["Deep Truth"]);
    report.deep.total_rows = deepRows.length;

    const fingerprintMap = new Map();
    const SAMPLE_IDS = ['CORE-IIT-BOMBAY', 'CORE-NIT-TRICHY', 'CORE-IIT-DELHI', 'CORE-AIIMS-DELHI'];

    deepRows.forEach((row, i) => {
        const id = row.institution_id;
        const domain = row.domain;
        const authority = row.source_authority;
        const confidence = row.hydration_confidence;

        if (!id) report.deep.missing_ids++;

        // Fingerprint for duplicates
        const fingerprint = `${id}|${domain}|${row.program}|${row.quota}|${row.category}|${row.gender_pool}|${row.round}|${row.opening_rank}|${row.closing_rank}|${row.seat_count}|${row.year}|${authority}`;
        if (fingerprintMap.has(fingerprint)) report.deep.duplicate_fingerprints++;
        fingerprintMap.set(fingerprint, true);

        // Mixed truth check
        const hasRank = (row.opening_rank !== null && row.opening_rank !== undefined) || (row.closing_rank !== null && row.closing_rank !== undefined);
        const hasSeat = row.seat_count !== null && row.seat_count !== undefined;

        if (hasRank && hasSeat) {
            report.deep.mixed_truth_rows++;
            if (report.deep.violations.length < 20) {
                report.deep.violations.push({ row: i + 2, id, reason: "Mixed Truth: Contains both Rank and Seat data" });
            }
        }

        if (!hasRank && !hasSeat) {
            report.deep.empty_truth_rows++;
            if (report.deep.violations.length < 20) {
                report.deep.violations.push({ row: i + 2, id, reason: "Empty Truth: Missing both Rank and Seat data" });
            }
        }

        // Distributions
        report.deep.domain_distribution[domain] = (report.deep.domain_distribution[domain] || 0) + 1;
        report.deep.authority_distribution[authority] = (report.deep.authority_distribution[authority] || 0) + 1;
        report.deep.confidence_distribution[confidence] = (report.deep.confidence_distribution[confidence] || 0) + 1;

        // Samples
        if (SAMPLE_IDS.includes(id)) {
            report.deep.institution_samples[id] = (report.deep.institution_samples[id] || 0) + 1;
        }
    });

    // --- 3. FINAL SUMMARY ---
    report.summary.checks = {
        master_missing_ids: report.master.missing_ids,
        master_duplicate_ids: report.master.duplicate_ids,
        master_tier_mismatches: report.master.tier_mismatches,
        deep_missing_ids: report.deep.missing_ids,
        deep_duplicate_fingerprints: report.deep.duplicate_fingerprints,
        mixed_truth_rows: report.deep.mixed_truth_rows,
        empty_truth_rows: report.deep.empty_truth_rows
    };

    report.summary.passed = Object.values(report.summary.checks).every(v => v === 0);

    const reportPath = path.join(__dirname, '../reports/excel_export_audit.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📊 Excel Audit Complete.`);
    console.log(`-----------------------------------`);
    console.log(`Master Rows: ${report.master.total_rows}`);
    console.log(`Deep Rows:   ${report.deep.total_rows}`);
    console.log(`-----------------------------------`);
    console.log(`STATUS: ${report.summary.passed ? '✅ PASS' : '❌ FAIL'}`);
    
    if (!report.summary.passed) {
        console.log(`\n❌ VIOLATIONS DETECTED:`);
        Object.entries(report.summary.checks).forEach(([check, count]) => {
            if (count > 0) console.log(` - ${check}: ${count}`);
        });

        console.log(`\nTop Offending Rows:`);
        [...report.master.violations, ...report.deep.violations].slice(0, 20).forEach(v => {
            console.log(` [Row ${v.row}] ${v.id}: ${v.reason}`);
        });
    }

    process.exit(report.summary.passed ? 0 : 1);
}

runAudit();
