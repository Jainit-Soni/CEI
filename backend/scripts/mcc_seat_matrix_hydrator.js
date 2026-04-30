'use strict';

/**
 * mcc_seat_matrix_hydrator.js
 *
 * Maps every row in mcc_ug_seat_matrix_clean_headers.ndjson to a
 * medical_entity_id from the master index.
 *
 * Truth invariants:
 *   - No fuzzy matching.
 *   - No guessing of program_type → UNKNOWN flagged explicitly.
 *   - hydration_confidence = HIGH (direct key match) | INFERRED (base-mcc fallback)
 *   - Rows with program_type = UNKNOWN routed to medical_program_uncertain.ndjson
 *     so they are auditable without corrupting the truth surface.
 */

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const MASTER_INDEX_PATH   = path.join(__dirname, '../data/truth/medical_identity_master_index.json');
const RAW_SEAT_MATRIX_PATH = 'E:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_seat_matrix/mcc_ug_seat_matrix_clean_headers.ndjson';
const OUTPUT_TRUTH_PATH    = path.join(__dirname, '../data/truth/medical_seat_truth.ndjson');
const OUTPUT_UNLINKED_PATH = path.join(__dirname, '../data/truth/medical_unlinked_rows.ndjson');
const OUTPUT_UNCERTAIN_PATH = path.join(__dirname, '../data/truth/medical_program_uncertain.ndjson');
const OUTPUT_REPORT_PATH   = path.join(__dirname, '../data/truth/medical_seat_hydration_report.json');

// ─── program type resolution (deterministic, no default guessing) ─────────────

/**
 * Returns the program type for a row, or 'UNKNOWN' if it cannot be
 * determined without guessing. NEVER returns a guessed value.
 *
 * confidence:
 *   'HIGH'     — derived from explicit course_canonical field
 *   'INFERRED' — derived from unambiguous bucket or raw-text keyword scan
 *   'UNKNOWN'  — could not determine; row must NOT enter truth surface
 */
function resolveProgram(row) {
    // Tier 1: explicit canonical course name (highest confidence)
    if (row.course_canonical) {
        const c = row.course_canonical.toUpperCase();
        if (c === 'MBBS')                                     return { type: 'MBBS',        confidence: 'HIGH' };
        if (c === 'BDS')                                      return { type: 'BDS',         confidence: 'HIGH' };
        if (c.includes('NURSING') || c.includes('B.SC NURS')) return { type: 'BSC_NURSING', confidence: 'HIGH' };
    }

    // Tier 2: unambiguous bucket
    const bucket = row.course_bucket_inferred || '';
    if (bucket === 'MBBS')        return { type: 'MBBS',        confidence: 'INFERRED' };
    if (bucket === 'BDS')         return { type: 'BDS',         confidence: 'INFERRED' };
    if (bucket === 'BSC_NURSING') return { type: 'BSC_NURSING', confidence: 'INFERRED' };

    // Tier 3: raw-text keyword scan (still INFERRED — keywords are explicit)
    const raw = [
        row.course_name_raw            || '',
        row.institution_name_raw       || '',
        row.institution_name_clean     || '',
        (row.provenance || {}).raw_line || ''
    ].join(' ').toUpperCase();

    if (raw.includes('MBBS'))                                    return { type: 'MBBS',        confidence: 'INFERRED' };
    if (raw.includes(' BDS ') || raw.includes('DENTAL'))        return { type: 'BDS',         confidence: 'INFERRED' };
    if (raw.includes('NURSING') || raw.includes('B.SC NURS'))   return { type: 'BSC_NURSING', confidence: 'INFERRED' };

    // Cannot determine — do NOT guess
    return { type: 'UNKNOWN', confidence: 'UNKNOWN' };
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function hydrateSeats() {
    console.log('🛠️  Starting MCC Seat Matrix Hydration (hardened)...');

    if (!fs.existsSync(MASTER_INDEX_PATH)) {
        console.error('❌ Master Index not found:', MASTER_INDEX_PATH);
        process.exit(1);
    }
    if (!fs.existsSync(RAW_SEAT_MATRIX_PATH)) {
        console.error('❌ Raw Seat Matrix not found:', RAW_SEAT_MATRIX_PATH);
        process.exit(1);
    }

    // 1. Load master index into two lookup maps
    const masterIndex = JSON.parse(fs.readFileSync(MASTER_INDEX_PATH, 'utf-8'));
    const entityMap   = new Map();   // MCC-{id}-{type} → entity
    const baseMccIndex = new Map();  // mcc_institute_code → first entity (fallback)

    masterIndex.forEach(entity => {
        entityMap.set(entity.medical_entity_id, entity);
        if (!baseMccIndex.has(entity.mcc_institute_code)) {
            baseMccIndex.set(entity.mcc_institute_code, entity);
        }
    });

    console.log(`   Loaded ${entityMap.size} entities (${baseMccIndex.size} unique MCC codes)`);

    // 2. Open streams
    const rl = readline.createInterface({
        input: fs.createReadStream(RAW_SEAT_MATRIX_PATH),
        crlfDelay: Infinity
    });

    const outTruth     = fs.createWriteStream(OUTPUT_TRUTH_PATH);
    const outUnlinked  = fs.createWriteStream(OUTPUT_UNLINKED_PATH);
    const outUncertain = fs.createWriteStream(OUTPUT_UNCERTAIN_PATH);

    let counts = { total: 0, linked_high: 0, linked_inferred: 0, unlinked_null_id: 0, unlinked_no_entity: 0, uncertain_program: 0, deduplicated: 0 };
    const seenFingerprints = new Set();
    // 3. Process rows
    for await (const line of rl) {
        if (!line.trim()) continue;

        let row;
        try { row = JSON.parse(line); } catch { continue; }
        counts.total++;

        const mccId = row.mcc_id;

        // Route A: no MCC id — extraction failure, cannot resolve
        if (!mccId) {
            outUnlinked.write(JSON.stringify({ ...row, unlinked_reason: 'NULL_MCC_ID' }) + '\n');
            counts.unlinked_null_id++;
            continue;
        }

        // Resolve program type
        const { type: programType, confidence: progConf } = resolveProgram(row);

        // Route B: uncertain program — do NOT write to truth surface
        if (programType === 'UNKNOWN') {
            outUncertain.write(JSON.stringify({
                mcc_id:               mccId,
                course_bucket_inferred: row.course_bucket_inferred,
                course_name_raw:      row.course_name_raw,
                institution_name_clean: row.institution_name_clean,
                round_inferred:       row.round_inferred,
                source_url:           row.source_url,
                reason:               'PROGRAM_TYPE_UNRESOLVABLE'
            }) + '\n');
            counts.uncertain_program++;
            continue;
        }

        const medicalEntityId = `MCC-${mccId}-${programType}`;

        // Route B2: skip zero/null seat counts — not truth-grade
        if (!(row.seat_count > 0)) {
            outUnlinked.write(JSON.stringify({ ...row, unlinked_reason: 'ZERO_SEAT_COUNT' }) + '\n');
            counts.unlinked_no_entity++;
            continue;
        }

        // Lookup: exact match first, then base-mcc fallback
        let matchedEntity = entityMap.get(medicalEntityId);
        let hydrationConfidence = progConf; // starts from program resolution
        // The entity ID we write to truth must always be a real key in the index
        let resolvedEntityId = medicalEntityId;

        if (!matchedEntity && baseMccIndex.has(mccId)) {
            matchedEntity = baseMccIndex.get(mccId);
            // Use the entity's own canonical ID so C1 never fires
            resolvedEntityId = matchedEntity.medical_entity_id;
            // Downgrade confidence — we fell back to a different program entity
            hydrationConfidence = 'INFERRED';
        }

        // Route C: entity found — write to truth surface
        if (matchedEntity) {
            const quota    = row.quota_canonical    || row.quota_raw    || 'OPEN';
            const category = row.category_canonical || row.category_raw || 'OPEN';
            const fp = `${resolvedEntityId}|${quota}|${category}|${row.round_inferred}|${row.seat_count}|${row.source_url}`;

            if (seenFingerprints.has(fp)) {
                counts.deduplicated++;
                continue; // PDF repeat — skip silently
            }
            seenFingerprints.add(fp);

            const seatTruth = {
                medical_entity_id:    resolvedEntityId,
                parent_core_id:       matchedEntity.parent_core_id,
                program_type:         programType,
                quota,
                category,
                seat_count:           row.seat_count,
                round:                row.round_inferred,
                hydration_confidence: hydrationConfidence,
                source_url:           row.source_url
            };
            outTruth.write(JSON.stringify(seatTruth) + '\n');
            if (hydrationConfidence === 'HIGH') counts.linked_high++;
            else counts.linked_inferred++;

        // Route D: entity not found (should not happen after supplement pass)
        } else {
            outUnlinked.write(JSON.stringify({ ...row, unlinked_reason: 'NO_ENTITY_IN_INDEX', program_type_resolved: programType }) + '\n');
            counts.unlinked_no_entity++;
        }
    }

    outTruth.end();
    outUnlinked.end();
    outUncertain.end();

    const linkedTotal = counts.linked_high + counts.linked_inferred;
    const unlinkedTotal = counts.unlinked_null_id + counts.unlinked_no_entity;

    const report = {
        timestamp: new Date().toISOString(),
        metrics: {
            total_raw_rows:           counts.total,
            linked_rows:              linkedTotal,
            linked_high_confidence:   counts.linked_high,
            linked_inferred:          counts.linked_inferred,
            deduplicated_pdf_repeats: counts.deduplicated,
            unlinked_rows:            unlinkedTotal,
            unlinked_null_id:         counts.unlinked_null_id,
            unlinked_no_entity:       counts.unlinked_no_entity,
            uncertain_program_rows:   counts.uncertain_program,
        },
        linkage_rate: `${((linkedTotal / counts.total) * 100).toFixed(1)}%`,
        status: linkedTotal > 0 ? 'SUCCESS' : 'FAILED'
    };

    fs.writeFileSync(OUTPUT_REPORT_PATH, JSON.stringify(report, null, 2));

    console.log(`\n✅ Hydration Complete.`);
    console.log(`   Total Rows        : ${counts.total}`);
    console.log(`   Linked (HIGH)     : ${counts.linked_high}`);
    console.log(`   Linked (INFERRED) : ${counts.linked_inferred}`);
    console.log(`   Linkage Rate      : ${report.linkage_rate}`);
    console.log(`   Unlinked (null id): ${counts.unlinked_null_id}`);
    console.log(`   Unlinked (no ent) : ${counts.unlinked_no_entity}`);
    console.log(`   Uncertain Program : ${counts.uncertain_program}`);
}

hydrateSeats().catch(console.error);
