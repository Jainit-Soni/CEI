'use strict';

/**
 * mcc_null_id_recovery.js
 *
 * Recovery pass for the 59 rows with null mcc_id in medical_unlinked_rows.ndjson.
 *
 * Strategy (deterministic, no fuzzy matching):
 *   For each null-mcc_id row, scan these fields in priority order for a 6-digit
 *   numeric code bracketed as (XXXXXX):
 *     1. provenance.raw_line        — the original PDF text line
 *     2. provenance.previous_line   — the PDF line above
 *     3. provenance.next_line       — the PDF line below
 *     4. institution_name_raw       — already-parsed institution field
 *
 *   If a code is found, it becomes the recovered mcc_id.
 *   The row is then re-attempted against the master index (same logic as hydrator).
 *   Recovered rows are written to medical_seat_truth.ndjson (appended).
 *
 * Outputs:
 *   medical_recovery_report.json    — full audit of what was / wasn't recovered
 *   medical_unlinked_final.ndjson   — rows that are truly irrecoverable
 *
 * Invariants:
 *   - The code must be exactly 6 digits enclosed in parentheses.
 *   - No substring matching of names.
 *   - No writing to truth surface without a valid master index hit.
 */

const fs   = require('fs');
const path = require('path');

const MASTER_INDEX_PATH   = path.join(__dirname, '../data/truth/medical_identity_master_index.json');
const UNLINKED_PATH       = path.join(__dirname, '../data/truth/medical_unlinked_rows.ndjson');
const TRUTH_MAIN_PATH     = path.join(__dirname, '../data/truth/medical_seat_truth.ndjson');  // read-only
const RECOVERED_PATH      = path.join(__dirname, '../data/truth/medical_seat_truth_recovered.ndjson');
const FINAL_UNLINKED_PATH = path.join(__dirname, '../data/truth/medical_unlinked_final.ndjson');
const RECOVERY_REPORT     = path.join(__dirname, '../data/truth/medical_recovery_report.json');

// ─── helpers ──────────────────────────────────────────────────────────────────

// Extract the first 6-digit MCC code from a string, e.g. "(200541)"
const MCC_RE = /\((\d{6})\)/;

function extractMccFromText(text) {
    if (!text) return null;
    const m = text.match(MCC_RE);
    return m ? m[1] : null;
}

function resolveProgram(row) {
    if (row.course_canonical) {
        const c = row.course_canonical.toUpperCase();
        if (c === 'MBBS')                                      return { type: 'MBBS',        confidence: 'HIGH' };
        if (c === 'BDS')                                       return { type: 'BDS',         confidence: 'HIGH' };
        if (c.includes('NURSING') || c.includes('B.SC NURS')) return { type: 'BSC_NURSING', confidence: 'HIGH' };
    }
    const bucket = row.course_bucket_inferred || '';
    if (bucket === 'MBBS')        return { type: 'MBBS',        confidence: 'INFERRED' };
    if (bucket === 'BDS')         return { type: 'BDS',         confidence: 'INFERRED' };
    if (bucket === 'BSC_NURSING') return { type: 'BSC_NURSING', confidence: 'INFERRED' };

    const raw = [
        row.course_name_raw            || '',
        row.institution_name_raw       || '',
        (row.provenance || {}).raw_line || ''
    ].join(' ').toUpperCase();

    if (raw.includes('MBBS'))                                  return { type: 'MBBS',        confidence: 'INFERRED' };
    if (raw.includes(' BDS ') || raw.includes('DENTAL'))      return { type: 'BDS',         confidence: 'INFERRED' };
    if (raw.includes('NURSING') || raw.includes('B.SC NURS')) return { type: 'BSC_NURSING', confidence: 'INFERRED' };

    return { type: 'UNKNOWN', confidence: 'UNKNOWN' };
}

// ─── main ─────────────────────────────────────────────────────────────────────

function recover() {
    console.log('🔧 MCC Null-ID Recovery Pass');

    if (!fs.existsSync(UNLINKED_PATH)) {
        console.error('❌ Unlinked rows file not found:', UNLINKED_PATH);
        process.exit(1);
    }

    // 1. Load master index lookups
    const masterIndex  = JSON.parse(fs.readFileSync(MASTER_INDEX_PATH, 'utf-8'));
    const entityMap    = new Map(masterIndex.map(e => [e.medical_entity_id, e]));
    const baseMccIndex = new Map();
    masterIndex.forEach(e => {
        if (!baseMccIndex.has(e.mcc_institute_code)) baseMccIndex.set(e.mcc_institute_code, e);
    });

    // 2. Load unlinked rows — only process null-mcc_id ones
    const unlinkedLines = fs.readFileSync(UNLINKED_PATH, 'utf-8').split('\n').filter(Boolean);

    const outRecovered    = fs.createWriteStream(RECOVERED_PATH);      // separate file — no collision
    const outFinalUnlinked = fs.createWriteStream(FINAL_UNLINKED_PATH);

    const stats = { total_null_id: 0, recovered: 0, irrecoverable: 0, non_null_passthrough: 0, deduplicated: 0 };
    const recoveryLog = [];

    // Seed the dedup fingerprint set from the existing hydrator truth output
    // so recovery rows that duplicate hydrator output are silently dropped.
    const seenFingerprints = new Set();
    if (fs.existsSync(TRUTH_MAIN_PATH)) {
        fs.readFileSync(TRUTH_MAIN_PATH, 'utf-8').split('\n').filter(Boolean).forEach(l => {
            try {
                const r = JSON.parse(l);
                const fp = `${r.medical_entity_id}|${r.quota}|${r.category}|${r.round}|${r.seat_count}|${r.source_url || ''}`;
                seenFingerprints.add(fp);
            } catch {}
        });
    }

    for (const line of unlinkedLines) {
        let row;
        try { row = JSON.parse(line); } catch { continue; }

        // Pass through rows that already have an mcc_id (they unlinked for other reasons)
        if (row.mcc_id) {
            outFinalUnlinked.write(JSON.stringify(row) + '\n');
            stats.non_null_passthrough++;
            continue;
        }

        stats.total_null_id++;
        const prov = row.provenance || {};

        // 3. Try to extract mcc code from context fields (priority order)
        const recoveredId =
            extractMccFromText(prov.raw_line)      ||
            extractMccFromText(prov.previous_line) ||
            extractMccFromText(prov.next_line)     ||
            extractMccFromText(row.institution_name_raw);

        if (!recoveredId) {
            outFinalUnlinked.write(JSON.stringify({ ...row, recovery_status: 'NO_CODE_IN_CONTEXT' }) + '\n');
            recoveryLog.push({ status: 'FAILED', reason: 'no_code_in_context', doc: row.document_title, line: prov.line_index });
            stats.irrecoverable++;
            continue;
        }

        // 4. Resolve program type
        const { type: programType, confidence: progConf } = resolveProgram(row);

        if (programType === 'UNKNOWN') {
            outFinalUnlinked.write(JSON.stringify({ ...row, recovery_status: 'UNKNOWN_PROGRAM', recovered_mcc_id: recoveredId }) + '\n');
            recoveryLog.push({ status: 'FAILED', reason: 'unknown_program', mcc_id: recoveredId, doc: row.document_title });
            stats.irrecoverable++;
            continue;
        }

        // 5. Look up in master index
        const entityId = `MCC-${recoveredId}-${programType}`;
        let matchedEntity = entityMap.get(entityId);
        let hydrationConfidence = progConf;

        if (!matchedEntity && baseMccIndex.has(recoveredId)) {
            matchedEntity = baseMccIndex.get(recoveredId);
            hydrationConfidence = 'INFERRED';
        }

        if (!matchedEntity) {
            outFinalUnlinked.write(JSON.stringify({ ...row, recovery_status: 'NO_ENTITY_AFTER_RECOVERY', recovered_mcc_id: recoveredId }) + '\n');
            recoveryLog.push({ status: 'FAILED', reason: 'no_entity_for_recovered_id', mcc_id: recoveredId, entity_id: entityId });
            stats.irrecoverable++;
            continue;
        }

        // Guard: skip zero-seat rows
        if (!(row.seat_count > 0)) {
            outFinalUnlinked.write(JSON.stringify({ ...row, recovery_status: 'ZERO_SEAT_COUNT', recovered_mcc_id: recoveredId }) + '\n');
            stats.irrecoverable++;
            continue;
        }

        const quota    = row.quota_canonical    || row.quota_raw    || 'OPEN';
        const category = row.category_canonical || row.category_raw || 'OPEN';
        const sourceUrl = row.source_url || '';
        const fp = `${matchedEntity.medical_entity_id}|${quota}|${category}|${row.round_inferred}|${row.seat_count}|${sourceUrl}`;

        if (seenFingerprints.has(fp)) {
            stats.deduplicated++;
            continue; // already in truth surface — skip
        }
        seenFingerprints.add(fp);

        // 6. Write recovered row to separate recovered truth file
        const seatTruth = {
            medical_entity_id:    matchedEntity.medical_entity_id,
            parent_core_id:       matchedEntity.parent_core_id,
            program_type:         programType,
            quota,
            category,
            seat_count:           row.seat_count,
            round:                row.round_inferred,
            hydration_confidence: hydrationConfidence,
            source_url:           sourceUrl || undefined,
            recovery:             { recovered_from: 'null_id_context_scan', recovered_mcc_id: recoveredId }
        };

        outRecovered.write(JSON.stringify(seatTruth) + '\n');
        recoveryLog.push({ status: 'RECOVERED', mcc_id: recoveredId, entity_id: matchedEntity.medical_entity_id, confidence: hydrationConfidence });
        stats.recovered++;
    }

    outRecovered.end();
    outFinalUnlinked.end();

    const report = {
        timestamp:          new Date().toISOString(),
        stats,
        recovery_rate:      stats.total_null_id > 0
            ? `${((stats.recovered / stats.total_null_id) * 100).toFixed(1)}%`
            : 'N/A',
        output_file:        RECOVERED_PATH,
        recovery_log:       recoveryLog
    };

    fs.writeFileSync(RECOVERY_REPORT, JSON.stringify(report, null, 2));

    console.log(`\n   Null-id rows attempted : ${stats.total_null_id}`);
    console.log(`   Recovered              : ${stats.recovered}`);
    console.log(`   Deduplicated (skipped) : ${stats.deduplicated}`);
    console.log(`   Irrecoverable          : ${stats.irrecoverable}`);
    console.log(`   Recovery rate          : ${report.recovery_rate}`);
    console.log(`📂 Report: ${RECOVERY_REPORT}`);
}

recover();
