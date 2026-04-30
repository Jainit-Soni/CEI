const fs = require('fs');

const FINAL_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_cutoff_truth_final.ndjson';

function audit() {
    console.log('Auditing Medical Cutoff Truth Final...');
    const content = fs.readFileSync(FINAL_PATH, 'utf8');
    const rows = content.trim().split('\n').map(line => JSON.parse(line));

    const errors = [];
    const fingerprints = new Set();

    rows.forEach((row, idx) => {
        const lineNo = idx + 1;

        // 1. Identity Format
        if (!row.medical_entity_id || !row.medical_entity_id.startsWith('MCC-')) {
            errors.push(`Line ${lineNo}: Invalid medical_entity_id: ${row.medical_entity_id}`);
        }

        // 2. Rank Validity
        if (typeof row.closing_rank !== 'number' || isNaN(row.closing_rank)) {
            errors.push(`Line ${lineNo}: Invalid closing_rank: ${row.closing_rank}`);
        }

        // 3. Essential Fields
        ['quota', 'category', 'round', 'lineage'].forEach(field => {
            if (!row[field]) {
                errors.push(`Line ${lineNo}: Missing required field: ${field}`);
            }
        });

        // 4. Uniqueness
        const fp = `${row.medical_entity_id}|${row.quota}|${row.category}|${row.round}|${row.closing_rank}`;
        if (fingerprints.has(fp)) {
            errors.push(`Line ${lineNo}: Duplicate row detected: ${fp}`);
        }
        fingerprints.add(fp);
    });

    if (errors.length === 0) {
        console.log('✅ AUDIT PASSED');
        console.log(`Total Verified Rows: ${rows.length}`);
    } else {
        console.error('❌ AUDIT FAILED');
        console.error(errors.join('\n'));
        process.exit(1);
    }
}

audit();
