'use strict';

/**
 * consolidate_medical_seat_truth.js
 *
 * Produces medical_seat_truth_final.ndjson — the ONLY file downstream
 * systems (API, UI, analytics) should consume.
 *
 * Steps:
 *   1. Load master index for entity validation.
 *   2. Merge hydrator output + recovery output.
 *   3. Enforce source_url invariant — rows missing it are flagged, not dropped.
 *   4. Tag every row with lineage: "hydrator" | "recovery".
 *   5. Deduplicate (same fingerprint as pipeline): entity|quota|category|round|seat_count|source_url
 *   6. Sort deterministically: entity_id → round → quota → category.
 *   7. Write to medical_seat_truth_final.ndjson.
 *   8. Write consolidation_report.json with full metrics.
 *
 * Invariants enforced here:
 *   [I1] Every row medical_entity_id must exist in master index.
 *   [I2] Every row seat_count must be > 0.
 *   [I3] Duplicate fingerprints are dropped — first occurrence wins.
 *   [I4] source_url missing → flagged, confidence downgraded, NOT dropped.
 *   [I5] Final file is sorted — output is reproducible across runs.
 */

const fs   = require('fs');
const path = require('path');

const MASTER_INDEX_PATH = path.join(__dirname, '../data/truth/medical_identity_master_index.json');
const TRUTH_MAIN        = path.join(__dirname, '../data/truth/medical_seat_truth.ndjson');
const TRUTH_RECOVERED   = path.join(__dirname, '../data/truth/medical_seat_truth_recovered.ndjson');
const FINAL_OUTPUT      = path.join(__dirname, '../data/truth/medical_seat_truth_final.ndjson');
const REPORT_PATH       = path.join(__dirname, '../data/truth/medical_consolidation_report.json');

const SORT_KEYS = ['medical_entity_id', 'round', 'quota', 'category'];

function loadNdjson(filePath) {
    if (!fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l));
}

function sortKey(row) {
    return SORT_KEYS.map(k => row[k] || '').join('|');
}

function consolidate() {
    console.log('🗜️  Consolidating Medical Seat Truth Surface...');

    // 1. Load master index
    const masterIndex = JSON.parse(fs.readFileSync(MASTER_INDEX_PATH, 'utf-8'));
    const entityMap   = new Map(masterIndex.map(e => [e.medical_entity_id, e]));

    // 2. Merge both sources with lineage tag
    const hydratorRows = loadNdjson(TRUTH_MAIN).map(r => ({ ...r, lineage: 'hydrator' }));
    const recoveredRows = loadNdjson(TRUTH_RECOVERED).map(r => ({ ...r, lineage: 'recovery' }));
    const allRows = [...hydratorRows, ...recoveredRows];

    console.log(`   Hydrator rows  : ${hydratorRows.length}`);
    console.log(`   Recovery rows  : ${recoveredRows.length}`);
    console.log(`   Total incoming : ${allRows.length}`);

    // 3-5. Validate, tag, deduplicate
    const seenFingerprints = new Set();
    const finalRows = [];
    const rejected  = { i1_invalid_entity: 0, i2_zero_seat: 0, i3_duplicate: 0 };
    let i4_missing_url = 0;

    for (const row of allRows) {
        // I1: entity must exist in master index
        if (!entityMap.has(row.medical_entity_id)) {
            rejected.i1_invalid_entity++;
            continue;
        }

        // I2: seat_count must be > 0
        if (!(row.seat_count > 0)) {
            rejected.i2_zero_seat++;
            continue;
        }

        // I4: source_url invariant — flag missing, don't drop
        const sourceUrl = row.source_url || '';
        let consolidatedRow = { ...row };
        if (!sourceUrl) {
            i4_missing_url++;
            consolidatedRow.missing_source_url = true;
            // Downgrade confidence if not already INFERRED
            if (consolidatedRow.hydration_confidence === 'HIGH') {
                consolidatedRow.hydration_confidence = 'INFERRED';
            }
        }

        // I3: deduplicate
        const fp = `${row.medical_entity_id}|${row.quota}|${row.category}|${row.round}|${row.seat_count}|${sourceUrl}`;
        if (seenFingerprints.has(fp)) {
            rejected.i3_duplicate++;
            continue;
        }
        seenFingerprints.add(fp);

        finalRows.push(consolidatedRow);
    }

    // 6. Sort deterministically
    finalRows.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

    // 7. Write final output
    const out = fs.createWriteStream(FINAL_OUTPUT);
    finalRows.forEach(r => out.write(JSON.stringify(r) + '\n'));
    out.end();

    // Confidence breakdown
    const highConf     = finalRows.filter(r => r.hydration_confidence === 'HIGH').length;
    const inferredConf = finalRows.filter(r => r.hydration_confidence === 'INFERRED').length;
    const lineageSplit = {
        hydrator: finalRows.filter(r => r.lineage === 'hydrator').length,
        recovery: finalRows.filter(r => r.lineage === 'recovery').length,
    };
    const entitiesWithSeats = new Set(finalRows.map(r => r.medical_entity_id)).size;

    // 8. Write report
    const report = {
        timestamp:              new Date().toISOString(),
        input: {
            hydrator_rows:      hydratorRows.length,
            recovery_rows:      recoveredRows.length,
        },
        output: {
            final_rows:         finalRows.length,
            entities_covered:   entitiesWithSeats,
            lineage:            lineageSplit,
            confidence: {
                HIGH:           highConf,
                INFERRED:       inferredConf,
            },
        },
        rejected,
        flags: {
            missing_source_url: i4_missing_url,
        },
        output_file:            FINAL_OUTPUT,
        status:                 finalRows.length > 0 ? 'SUCCESS' : 'FAILED',
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    console.log(`\n✅ Consolidation Complete.`);
    console.log(`   Final rows         : ${finalRows.length}`);
    console.log(`   Entities covered   : ${entitiesWithSeats} / ${masterIndex.length}`);
    console.log(`   Lineage hydrator   : ${lineageSplit.hydrator}`);
    console.log(`   Lineage recovery   : ${lineageSplit.recovery}`);
    console.log(`   Confidence HIGH    : ${highConf}`);
    console.log(`   Confidence INFERRED: ${inferredConf}`);
    console.log(`   Missing source_url : ${i4_missing_url} (flagged, not dropped)`);
    console.log(`   Rejected I1        : ${rejected.i1_invalid_entity}`);
    console.log(`   Rejected I2        : ${rejected.i2_zero_seat}`);
    console.log(`   Rejected I3 (dedup): ${rejected.i3_duplicate}`);
    console.log(`\n📂 Output : ${FINAL_OUTPUT}`);
    console.log(`📂 Report : ${REPORT_PATH}`);
}

consolidate();
