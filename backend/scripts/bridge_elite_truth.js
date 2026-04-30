const fs = require('fs');
const path = require('path');

const SOURCES = [
    {
        input: 'cei-extractors/sources/output/josaa_seat_matrix_all_normalized.ndjson',
        output: 'backend/data/truth/josaa_seats.ndjson',
        type: 'counsellingSeat',
        transform: (row) => ({
            entityType: 'counsellingSeat',
            collegeId: null,
            institutionName: row.institute_name_normalized,
            stableKey: row.entity_key,
            courseFamily: 'BE/BTECH',
            session: row.academic_year,
            seatType: row.seat_pool_canonical,
            quota: row.quota_scope_canonical,
            intake: row.total_includes_female_supernumerary,
            programName: row.program_name_raw,
            sourceFamily: 'JOSAA',
            sourceAuthority: 'Joint Seat Allocation Authority (JoSAA)',
            sourceUrl: row.source_url,
            extractedAt: row.extracted_at,
            officialityLevel: 'official'
        })
    },
    {
        input: 'cei-extractors/sources/output/csab_orcr_all_rounds_normalized.ndjson',
        output: 'backend/data/truth/csab_cutoffs.ndjson',
        type: 'counsellingCutoff',
        transform: (row) => ({
            entityType: 'counsellingCutoff',
            collegeId: null,
            institutionName: row.institute_name_raw,
            stableKey: row.entity_key,
            courseFamily: 'BE/BTECH',
            session: row.academic_year,
            round: `Special Round ${row.special_round}`,
            cutoffKind: 'closing_rank',
            programName: row.academic_program_name_raw,
            category: row.seat_type_canonical,
            quota: row.quota_canonical,
            gender: row.gender_canonical,
            closingRank: row.closing_rank,
            sourceFamily: 'CSAB',
            sourceAuthority: 'Central Seat Allocation Board (CSAB)',
            sourceUrl: row.source_url,
            extractedAt: row.extracted_at,
            officialityLevel: 'official'
        })
    },
    {
        input: 'cei-extractors/sources/output/csab_instprofile_seat_rows.ndjson',
        output: 'backend/data/truth/csab_seats.ndjson',
        type: 'counsellingSeat',
        transform: (row) => ({
            entityType: 'counsellingSeat',
            collegeId: null,
            institutionName: row.institute_name,
            stableKey: row.entity_key,
            courseFamily: 'BE/BTECH',
            session: '2025-26',
            seatType: row.seat_pool,
            quota: row.state_all_india_seats,
            intake: row.total_includes_female_supernumerary,
            programName: row.program_name,
            sourceFamily: 'CSAB',
            sourceAuthority: 'Central Seat Allocation Board (CSAB)',
            sourceUrl: row.source_url,
            extractedAt: row.extracted_at,
            officialityLevel: 'official'
        })
    }
];

SOURCES.forEach(source => {
    console.log(`Processing ${source.input}...`);
    if (!fs.existsSync(source.input)) {
        console.warn(`Source not found: ${source.input}`);
        return;
    }
    const lines = fs.readFileSync(source.input, 'utf8').split('\n').filter(Boolean);
    const stream = fs.createWriteStream(source.output);
    lines.forEach(line => {
        try {
            const row = JSON.parse(line);
            const out = source.transform(row);
            stream.write(JSON.stringify(out) + '\n');
        } catch (err) {}
    });
    stream.end(() => console.log(`Finished ${source.output} (${lines.length} rows)`));
});
