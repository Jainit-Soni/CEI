const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data/truth');
const ID_REG_PATH = path.join(DATA_DIR, 'identity_registry.json');
const MASTER_INDEX_PATH = path.join(DATA_DIR, 'identity_master_index.json');

console.log('--- EXPANDING IDENTITY REGISTRY FROM MASTER INDEX ---');

const idReg = JSON.parse(fs.readFileSync(ID_REG_PATH, 'utf8'));
const masterIndex = JSON.parse(fs.readFileSync(MASTER_INDEX_PATH, 'utf8')).institutions;

let added = 0;
let updated = 0;

for (const id in masterIndex) {
    const inst = masterIndex[id];
    if (!idReg[id]) {
        idReg[id] = {
            canonical_name: inst.canonical.name,
            aliases: inst.aliases || [],
            state: inst.canonical.state || 'UNKNOWN'
        };
        added++;
    } else {
        // Optional: Update existing if needed
        // For now, keep it as is to avoid regression
        updated++;
    }
}

console.log(`Expansion Summary:`);
console.log(`- New Institutions Added: ${added}`);
console.log(`- Existing Institutions Matched: ${updated}`);

fs.writeFileSync(ID_REG_PATH, JSON.stringify(idReg, null, 2));
console.log(`Saved expanded registry to ${ID_REG_PATH}`);
