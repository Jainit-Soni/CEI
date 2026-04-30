const fs = require('fs');
const path = require('path');
const readline = require('readline');

const MASTER_INDEX_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_identity_master_index.json';
const CUTOFF_SOURCE_PATH = 'E:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_results/mcc_ug_closing_ranks_v2.ndjson';

async function diagnose() {
    const masterIndex = JSON.parse(fs.readFileSync(MASTER_INDEX_PATH, 'utf8'));
    
    // Map of raw_name -> medical_entity_id
    const nameMap = new Map();
    masterIndex.forEach(entity => {
        if (entity.raw_names) {
            entity.raw_names.forEach(name => {
                const key = `${name.trim().toLowerCase()}|${entity.program_type}`;
                nameMap.set(key, entity.medical_entity_id);
            });
        }
    });

    const fileStream = fs.createReadStream(CUTOFF_SOURCE_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let totalRows = 0;
    let matchedRows = 0;
    const unlinkedNames = new Set();
    const unmatchedSamples = [];

    for await (const line of rl) {
        if (!line.trim()) continue;
        totalRows++;
        const row = JSON.parse(line);
        const course = row.course; // MBBS or BDS
        const rawName = row.institute_raw;
        
        const key = `${rawName.trim().toLowerCase()}|${course}`;
        
        if (nameMap.has(key)) {
            matchedRows++;
        } else {
            unlinkedNames.add(`${rawName}|${course}`);
            if (unmatchedSamples.length < 50) {
                unmatchedSamples.push({ rawName, course });
            }
        }
    }

    console.log(`Total Rows: ${totalRows}`);
    console.log(`Matched Rows: ${matchedRows} (${((matchedRows/totalRows)*100).toFixed(2)}%)`);
    console.log(`Unique Unlinked Names: ${unlinkedNames.size}`);
    
    console.log('\nSamples of unmatched names:');
    unmatchedSamples.slice(0, 20).forEach(s => console.log(`- [${s.course}] ${s.rawName}`));
}

diagnose();
