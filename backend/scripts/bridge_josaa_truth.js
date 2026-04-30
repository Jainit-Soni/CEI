const fs = require('fs');
const path = require('path');

const inputPath = 'cei-extractors/output/parsed/josaa_cei_package_2026-04-16T16-46-24-784Z/josaa_cutoffs_import_ready.json';
const outputPath = 'backend/data/truth/josaa_cutoffs.ndjson';

console.log('Loading JoSAA data...');
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
console.log(`Loaded ${data.length} records.`);

const stream = fs.createWriteStream(outputPath);

data.forEach(row => {
    const output = {
        entityType: 'counsellingCutoff',
        collegeId: null, // To be resolved during hydration
        institutionName: row.institute_name_normalized,
        stableKey: row.stable_import_key,
        state: null,
        courseFamily: 'BE/BTECH',
        session: row.academic_year,
        round: row.round_label,
        cutoffKind: 'closing_rank',
        programName: row.program_name_raw,
        category: row.canonical_category_label,
        quota: row.quota_canonical,
        gender: row.gender_pool_canonical,
        closingRank: row.closing_rank,
        sourceFamily: 'JOSAA',
        sourceAuthority: 'Joint Seat Allocation Authority (JoSAA)',
        sourceUrl: row.source_url,
        sourceDocumentType: 'JoSAA Official Allotment Results 2025',
        extractedAt: row.extracted_at,
        officialityLevel: 'official',
        confidence: 1.0
    };
    stream.write(JSON.stringify(output) + '\n');
});

stream.end(() => {
    console.log('Finished writing josaa_cutoffs.ndjson');
});
