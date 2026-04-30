const fs = require('fs');

const INPUT_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_cutoff_truth.ndjson';
const OUTPUT_FINAL_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_cutoff_truth_final.ndjson';

function consolidate() {
    console.log('Consolidating cutoff truth...');
    const content = fs.readFileSync(INPUT_PATH, 'utf8');
    const rows = content.trim().split('\n').map(line => JSON.parse(line));

    // Add lineage and metadata
    const finalRows = rows.map(row => ({
        ...row,
        lineage: 'hydrator',
        hydration_confidence: 'DIRECT'
    }));

    // Sorting
    finalRows.sort((a, b) => {
        if (a.medical_entity_id !== b.medical_entity_id) return a.medical_entity_id.localeCompare(b.medical_entity_id);
        if (a.round !== b.round) return a.round.localeCompare(b.round);
        if (a.quota !== b.quota) return a.quota.localeCompare(b.quota);
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.closing_rank - b.closing_rank;
    });

    fs.writeFileSync(OUTPUT_FINAL_PATH, finalRows.map(r => JSON.stringify(r)).join('\n') + '\n');
    console.log(`Consolidated ${finalRows.length} rows to ${OUTPUT_FINAL_PATH}`);
}

consolidate();
