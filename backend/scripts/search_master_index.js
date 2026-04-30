const fs = require('fs');
const MASTER_INDEX_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_identity_master_index.json';

const query = process.argv[2];
if (!query) {
    console.error('No query provided');
    process.exit(1);
}

const masterIndex = JSON.parse(fs.readFileSync(MASTER_INDEX_PATH, 'utf8'));
const results = masterIndex.filter(e => {
    return JSON.stringify(e).toLowerCase().includes(query.toLowerCase());
});

console.log(JSON.stringify(results, null, 2));
