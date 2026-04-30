const fs = require('fs');
const path = require('readline');
const readline = require('readline');

const MASTER_INDEX_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_identity_master_index.json';
const CUTOFF_SOURCE_PATH = 'E:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_results/mcc_ug_closing_ranks_v2.ndjson';
const OUTPUT_TRUTH_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_cutoff_truth.ndjson';
const UNLINKED_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/unlinked_cutoff_rows.ndjson';
const REPORT_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_cutoff_hydration_report.json';

const PREFIXES_TO_CLEAN = [
    'Seat Surrendered  ',
    'Reported  ',
    'Seat Surrendered Deemed/Paid Seats Quota ',
    'Reported - - - - - - No Upgradation ',
    'Reported - - - - - - Did not opt for Upgradation. ',
    'Reported - - - - - - Did not opt for Upgradation ',
    'Reported - - - - - - Did not opt for ',
    'Non-Resident Indian ',
    'Deemed/Paid Seats Quota ',
    'Foreign Country Quota ',
    'Internal -Puducherry UT Domicile ',
    'Internal - GS Quota ',
    'Internal - ',
    'Seat Surrendered '
];

function cleanInstituteName(name) {
    let cleaned = name.trim();
    for (const prefix of PREFIXES_TO_CLEAN) {
        if (cleaned.startsWith(prefix)) {
            cleaned = cleaned.substring(prefix.length).trim();
            // Recurse to catch multiple prefixes or double spaces left behind
            return cleanInstituteName(cleaned);
        }
    }
    return cleaned;
}

async function hydrate() {
    console.log('Loading master index...');
    const masterIndex = JSON.parse(fs.readFileSync(MASTER_INDEX_PATH, 'utf8'));
    
    // Exact Map: raw_name (lowercase) + program -> entity_id
    const exactMap = new Map();
    masterIndex.forEach(entity => {
        if (entity.raw_names) {
            entity.raw_names.forEach(name => {
                const key = `${name.trim().toLowerCase()}|${entity.program_type}`;
                exactMap.set(key, entity.medical_entity_id);
            });
        }
    });

    const fileStream = fs.createReadStream(CUTOFF_SOURCE_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const truthRows = [];
    const unlinkedRows = [];
    const seenFingerprints = new Set();

    let stats = {
        total: 0,
        hydrated: 0,
        unlinked: 0,
        duplicates: 0,
        program_mismatch: 0,
        filtered_nursing: 0
    };

    console.log('Processing cutoff rows...');

    for await (const line of rl) {
        if (!line.trim()) continue;
        stats.total++;

        const row = JSON.parse(line);
        
        // Filter out B.Sc Nursing as per directive (Medical = MBBS/BDS)
        if (row.course === 'B.Sc Nursing') {
            stats.filtered_nursing++;
            continue;
        }

        const course = row.course; // MBBS or BDS
        const rawName = row.institute_raw;
        
        let entityId = null;
        let matchMethod = 'NONE';

        // 1. Try exact match on raw name
        const exactKey = `${rawName.trim().toLowerCase()}|${course}`;
        if (exactMap.has(exactKey)) {
            entityId = exactMap.get(exactKey);
            matchMethod = 'EXACT';
        } else {
            // 2. Try cleaning name and match
            const cleanedName = cleanInstituteName(rawName);
            const cleanedKey = `${cleanedName.trim().toLowerCase()}|${course}`;
            if (exactMap.has(cleanedKey)) {
                entityId = exactMap.get(cleanedKey);
                matchMethod = 'CLEANED_EXACT';
            }
        }

        if (entityId) {
            // Check for program mismatch (e.g. entity is MBBS but row says BDS)
            // Our map already includes course in the key, so this is handled, 
            // but let's double check the resolved entityId suffix.
            if (!entityId.endsWith(course)) {
                stats.program_mismatch++;
                unlinkedRows.push({ ...row, failure_reason: 'PROGRAM_MISMATCH', resolved_entity_id: entityId });
                stats.unlinked++;
                continue;
            }

            const hydratedRow = {
                medical_entity_id: entityId,
                quota: row.quota,
                category: row.category,
                round: row.round,
                closing_rank: row.closing_rank,
                year: 2025, // Hardcoded for now based on file meta
                freshness: '2025-04-26',
                source: 'mcc_ug_cutoffs',
                match_method: matchMethod,
                institute_raw: rawName
            };

            // Deduplication
            const fingerprint = `${entityId}|${row.quota}|${row.category}|${row.round}|${row.closing_rank}`;
            if (seenFingerprints.has(fingerprint)) {
                stats.duplicates++;
                continue;
            }
            seenFingerprints.add(fingerprint);

            truthRows.push(hydratedRow);
            stats.hydrated++;
        } else {
            unlinkedRows.push({ ...row, failure_reason: 'NO_ENTITY_IN_INDEX' });
            stats.unlinked++;
        }
    }

    // Write truth
    fs.writeFileSync(OUTPUT_TRUTH_PATH, truthRows.map(r => JSON.stringify(r)).join('\n') + '\n');
    
    // Write unlinked
    fs.writeFileSync(UNLINKED_PATH, unlinkedRows.map(r => JSON.stringify(r)).join('\n') + '\n');

    // Write report
    const report = {
        timestamp: new Date().toISOString(),
        stats,
        unlinked_summary: unlinkedRows.reduce((acc, r) => {
            acc[r.failure_reason] = (acc[r.failure_reason] || 0) + 1;
            return acc;
        }, {})
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    console.log('\nHydration Complete.');
    console.log(`Total: ${stats.total}`);
    console.log(`Hydrated: ${stats.hydrated}`);
    console.log(`Unlinked: ${stats.unlinked}`);
    console.log(`Duplicates Filtered: ${stats.duplicates}`);
    console.log(`Nursing Filtered: ${stats.filtered_nursing}`);
    console.log('Report written to:', REPORT_PATH);
}

hydrate().catch(console.error);
