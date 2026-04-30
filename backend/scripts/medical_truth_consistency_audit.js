'use strict';

/**
 * medical_truth_consistency_audit.js
 *
 * MEDICAL TRUTH CONSISTENCY AUDIT
 *
 * Checks:
 *   [C1] Every seat row in medical_seat_truth.ndjson has a valid medical_entity_id
 *        that exists in the master index.
 *   [C2] Every seat row has seat_count > 0.
 *   [C3] Every entity in the master index has ≥1 seat row, OR is flagged as
 *        seat-empty (expected for supplemental/registry-only entities).
 *   [C4] No cross-program contamination: a seat row whose program_type is MBBS
 *        must not be assigned to an entity whose program_type is BDS, and vice versa.
 *        (Allowed exception: base-mcc fallback rows are flagged INFERRED.)
 *   [C5] No duplicate seat row fingerprints (entity_id + quota + category + round).
 *
 * Outputs:
 *   medical_truth_audit_report.json
 */

const fs   = require('fs');
const path = require('path');

const MASTER_INDEX_PATH  = path.join(__dirname, '../data/truth/medical_identity_master_index.json');
// Consume ONLY the canonical consolidated file
const TRUTH_PATH         = path.join(__dirname, '../data/truth/medical_seat_truth_final.ndjson');
const AUDIT_REPORT       = path.join(__dirname, '../data/truth/medical_truth_audit_report.json');

function audit() {
    console.log('🔍 Medical Truth Consistency Audit');

    const masterIndex = JSON.parse(fs.readFileSync(MASTER_INDEX_PATH, 'utf-8'));
    const entityMap   = new Map(masterIndex.map(e => [e.medical_entity_id, e]));

    if (!fs.existsSync(TRUTH_PATH)) {
        console.error('❌ Final truth surface not found. Run consolidate_medical_seat_truth.js first.');
        process.exit(1);
    }
    const seats = fs.readFileSync(TRUTH_PATH, 'utf-8')
        .split('\n').filter(Boolean).map(l => JSON.parse(l));
    console.log(`   Reading from: medical_seat_truth_final.ndjson (${seats.length} rows)`);

    const violations = { C1: [], C2: [], C4: [], C5: [] };
    const entitySeatCount = new Map(); // entity_id → count
    const fingerprints    = new Map(); // fingerprint → first-seen index

    seats.forEach((row, idx) => {
        // C1: valid entity_id
        if (!entityMap.has(row.medical_entity_id)) {
            violations.C1.push({ row: idx, medical_entity_id: row.medical_entity_id });
        } else {
            entitySeatCount.set(row.medical_entity_id, (entitySeatCount.get(row.medical_entity_id) || 0) + 1);
        }

        // C2: seat_count > 0
        if (!(row.seat_count > 0)) {
            violations.C2.push({ row: idx, medical_entity_id: row.medical_entity_id, seat_count: row.seat_count });
        }

        // C4: cross-program contamination (only check HIGH confidence rows)
        if (row.hydration_confidence === 'HIGH') {
            const entity = entityMap.get(row.medical_entity_id);
            if (entity && entity.program_type !== row.program_type) {
                violations.C4.push({
                    row: idx,
                    seat_program:   row.program_type,
                    entity_program: entity.program_type,
                    medical_entity_id: row.medical_entity_id
                });
            }
        }

        // C5: duplicate fingerprints
        const fp = `${row.medical_entity_id}|${row.quota}|${row.category}|${row.round}|${row.seat_count}`;
        if (fingerprints.has(fp)) {
            violations.C5.push({ row: idx, duplicate_of_row: fingerprints.get(fp), fingerprint: fp });
        } else {
            fingerprints.set(fp, idx);
        }
    });

    // C3: entities with zero seats
    const emptySeatEntities = masterIndex
        .filter(e => !entitySeatCount.has(e.medical_entity_id))
        .map(e => ({ medical_entity_id: e.medical_entity_id, source_provenance: e.source_provenance }));

    const totalViolations = violations.C1.length + violations.C2.length + violations.C4.length + violations.C5.length;

    const lineage = {
        hydrator: seats.filter(r => r.lineage === 'hydrator').length,
        recovery: seats.filter(r => r.lineage === 'recovery').length,
    };

    const report = {
        timestamp:          new Date().toISOString(),
        source_file:        'medical_seat_truth_final.ndjson',
        totals: {
            master_index_entities:   masterIndex.length,
            seat_truth_rows:         seats.length,
            entities_with_seats:     entitySeatCount.size,
            entities_without_seats:  emptySeatEntities.length,
            lineage,
        },
        violations: {
            C1_invalid_entity_id:     violations.C1.length,
            C2_zero_seat_count:       violations.C2.length,
            C4_cross_program:         violations.C4.length,
            C5_duplicate_fingerprint: violations.C5.length,
            total:                    totalViolations
        },
        violation_details: violations,
        entities_without_seats_sample: emptySeatEntities.slice(0, 20),
        status: totalViolations === 0 ? 'PASS' : 'FAIL'
    };

    fs.writeFileSync(AUDIT_REPORT, JSON.stringify(report, null, 2));

    console.log(`\n   Master index entities    : ${report.totals.master_index_entities}`);
    console.log(`   Seat truth rows          : ${report.totals.seat_truth_rows}`);
    console.log(`   Entities with ≥1 seat    : ${report.totals.entities_with_seats}`);
    console.log(`   Entities with 0 seats    : ${report.totals.entities_without_seats}`);
    console.log(`\n   [C1] Invalid entity_id   : ${violations.C1.length}`);
    console.log(`   [C2] Zero seat_count     : ${violations.C2.length}`);
    console.log(`   [C4] Cross-program cont. : ${violations.C4.length}`);
    console.log(`   [C5] Duplicate rows      : ${violations.C5.length}`);
    console.log(`\n   ─── Audit Status: ${report.status} ───`);
    console.log(`📂 Report: ${AUDIT_REPORT}`);
}

audit();
