/**
 * supplement_medical_identity_master.js
 *
 * Supplemental ingestion pass for the medical_identity_master_index.json.
 *
 * Problem:
 *   54 MCC IDs appear in the seat matrix but were never captured in the
 *   medical_identity_registry.json (the legacy registry). Without entries
 *   in the master index, the hydrator cannot link their seat rows.
 *
 * Strategy (deterministic, no fuzzy matching):
 *   1. Load the existing master index (built from the registry).
 *   2. Scan the seat matrix for every mcc_id that is missing from the index.
 *   3. For each missing mcc_id, collect the BEST available institution name
 *      from all seat matrix rows (prefer rows with high header_confidence and
 *      a clean institution_name_clean value).
 *   4. Infer program_type from course_canonical or course_bucket_inferred,
 *      falling back to keyword heuristics on the raw text.
 *   5. Append supplemental entities with source_provenance = "seat_matrix_supplement"
 *      so provenance remains auditable.
 *   6. Write the merged output back to medical_identity_master_index.json.
 *
 * Invariants:
 *   - No fuzzy matching ever happens.
 *   - Entities already in the index are NEVER overwritten.
 *   - Every supplemented entity carries an explicit source_provenance.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const MASTER_INDEX_PATH  = path.join(__dirname, '../data/truth/medical_identity_master_index.json');
const SEAT_MATRIX_PATH   = 'E:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_seat_matrix/mcc_ug_seat_matrix_clean_headers.ndjson';
const SUPPLEMENT_REPORT  = path.join(__dirname, '../data/truth/medical_identity_supplement_report.json');

// ─── helpers ──────────────────────────────────────────────────────────────────

function inferProgramType(row) {
    // Prefer explicit canonical course name first
    if (row.course_canonical) {
        const c = row.course_canonical.toUpperCase();
        if (c === 'MBBS')    return 'MBBS';
        if (c === 'BDS')     return 'BDS';
        if (c.includes('NURSING') || c.includes('BSC') || c.includes('B.SC')) return 'BSC_NURSING';
    }

    // Next: unambiguous bucket
    const bucket = row.course_bucket_inferred || '';
    if (bucket === 'MBBS')        return 'MBBS';
    if (bucket === 'BDS')         return 'BDS';
    if (bucket === 'BSC_NURSING') return 'BSC_NURSING';

    // Fall back: scan raw text
    const raw = [
        row.course_name_raw || '',
        row.institution_name_raw || '',
        row.institution_name_clean || '',
        (row.provenance || {}).raw_line || ''
    ].join(' ').toUpperCase();

    if (raw.includes('MBBS'))                                   return 'MBBS';
    if (raw.includes('BDS') || raw.includes('DENTAL'))          return 'BDS';
    if (raw.includes('NURSING') || raw.includes('B.SC NURS'))   return 'BSC_NURSING';

    return 'MBBS'; // safe default for medical colleges
}

function pickBestName(rows) {
    // Prefer rows with high header_confidence and a long, clean institution name
    const scored = rows
        .map(r => {
            const name = (r.institution_name_clean || r.institution_name_raw || '').trim();
            const conf = r.header_confidence === 'high' ? 2 : r.header_confidence === 'medium' ? 1 : 0;
            return { name, score: conf * 10 + name.length };
        })
        .filter(x => x.name.length > 4)
        .sort((a, b) => b.score - a.score);

    return scored.length ? scored[0].name : 'UNKNOWN';
}

// Strip noisy leading tokens (state names, quota prefixes, codes, etc.)
const STATE_PREFIXES = [
    'Andhra Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Delhi (NCT)',
    'Goa','Gujarat','Haryana','Himachal Pradesh','Jammu And Kashmir','Jharkhand',
    'Karnataka','Kerala','Ladakh','Madhya Pradesh','Maharashtra','Manipur',
    'Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan',
    'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand',
    'West Bengal','Arunachal Pradesh'
];

function cleanName(raw) {
    let s = raw;
    for (const pfx of STATE_PREFIXES) {
        if (s.startsWith(pfx + ' ')) { s = s.slice(pfx.length).trim(); break; }
    }
    // Strip trailing address fragments after a comma that look like postcodes
    s = s.replace(/,\s*\d{6}\s*$/, '').trim();
    return s.split(',')[0].trim() || s;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function supplementMasterIndex() {
    console.log('🔬 Supplemental Medical Identity Ingestion Pass');

    if (!fs.existsSync(MASTER_INDEX_PATH)) {
        console.error('❌ Master index not found:', MASTER_INDEX_PATH);
        process.exit(1);
    }
    if (!fs.existsSync(SEAT_MATRIX_PATH)) {
        console.error('❌ Seat matrix not found:', SEAT_MATRIX_PATH);
        process.exit(1);
    }

    // 1. Load existing master index
    const existing  = JSON.parse(fs.readFileSync(MASTER_INDEX_PATH, 'utf-8'));
    const existingIds = new Set(existing.map(e => e.mcc_institute_code));
    console.log(`   Existing entities: ${existing.length} (covering ${existingIds.size} unique MCC codes)`);

    // 2. Scan seat matrix — group all rows by mcc_id
    const seatLines = fs.readFileSync(SEAT_MATRIX_PATH, 'utf-8').split('\n').filter(Boolean);
    const grouped   = {};   // mcc_id → [row, …]

    for (const line of seatLines) {
        let row;
        try { row = JSON.parse(line); } catch { continue; }
        const id = row.mcc_id;
        if (!id || existingIds.has(id)) continue;
        if (!grouped[id]) grouped[id] = [];
        grouped[id].push(row);
    }

    const missingIds = Object.keys(grouped);
    console.log(`   MCC IDs in seat matrix but absent from master index: ${missingIds.length}`);

    // 3. Build supplemental entities
    const supplemented = [];

    for (const mccId of missingIds) {
        const rows    = grouped[mccId];
        const rawName = pickBestName(rows);
        const name    = cleanName(rawName);
        const pType   = inferProgramType(rows[0]);

        const entityId = `MCC-${mccId}-${pType}`;

        const entity = {
            medical_entity_id  : entityId,
            mcc_institute_code : mccId,
            canonical_name     : name,
            program_type       : pType,
            parent_core_id     : null,
            is_linked_to_core  : false,
            source_provenance  : 'seat_matrix_supplement',
            raw_names          : [...new Set(rows.map(r => (r.institution_name_clean || r.institution_name_raw || '').trim()).filter(Boolean))],
            quotas             : [...new Set(rows.map(r => r.quota_canonical || r.quota_raw || 'UNKNOWN').filter(Boolean))],
            legacy_mappings    : []
        };

        supplemented.push(entity);
    }

    console.log(`   Supplemental entities created: ${supplemented.length}`);

    // 4. Merge and write
    const merged = [...existing, ...supplemented];
    fs.writeFileSync(MASTER_INDEX_PATH, JSON.stringify(merged, null, 2));

    // 5. Write report
    const report = {
        timestamp         : new Date().toISOString(),
        existing_count    : existing.length,
        supplemented_count: supplemented.length,
        merged_total      : merged.length,
        supplemented_ids  : supplemented.map(e => ({
            mcc_id          : e.mcc_institute_code,
            medical_entity_id: e.medical_entity_id,
            canonical_name  : e.canonical_name,
            program_type    : e.program_type,
        }))
    };
    fs.writeFileSync(SUPPLEMENT_REPORT, JSON.stringify(report, null, 2));

    console.log(`\n✅ Master index updated: ${merged.length} total entities`);
    console.log(`📂 Report: ${SUPPLEMENT_REPORT}`);
}

supplementMasterIndex().catch(console.error);
