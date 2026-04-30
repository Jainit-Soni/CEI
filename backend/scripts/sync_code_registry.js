const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data/truth');
const CODE_REG_PATH = path.join(DATA_DIR, 'official_code_registry.json');
const ID_REG_PATH = path.join(DATA_DIR, 'identity_registry.json');
const ELITE_REG_PATH = path.join(DATA_DIR, 'elite_identity_registry.json');
const MASTER_INDEX_PATH = path.join(DATA_DIR, 'identity_master_index.json');

console.log('--- STARTING TRUTH-GRADE CODE REGISTRY SYNC (V3: HARDENING) ---');

const codeReg = JSON.parse(fs.readFileSync(CODE_REG_PATH, 'utf8'));
const idReg = JSON.parse(fs.readFileSync(ID_REG_PATH, 'utf8'));
const eliteReg = JSON.parse(fs.readFileSync(ELITE_REG_PATH, 'utf8'));
const masterIndex = JSON.parse(fs.readFileSync(MASTER_INDEX_PATH, 'utf8')).institutions;

// 1. Build Reverse Code Maps from Master Index (Deterministic Truth)
const aisheToId = new Map();
const aicteToId = new Map();
const josaaToId = new Map();

console.log(`Indexing ${Object.keys(masterIndex).length} institutions from Master Index...`);
for (const id in masterIndex) {
    const inst = masterIndex[id];
    if (inst.codes) {
        if (inst.codes.aishe) inst.codes.aishe.forEach(c => aisheToId.set(c, id));
        if (inst.codes.aicte) inst.codes.aicte.forEach(c => aicteToId.set(c, id));
        if (inst.codes.josaa) inst.codes.josaa.forEach(c => josaaToId.set(c, id));
    }
}

// 2. Build Elite Map (High Confidence Manual Links)
const eliteAisheToId = new Map();
eliteReg.forEach(e => {
    if (e.aisheCode && e.canonicalId) eliteAisheToId.set(e.aisheCode, e.canonicalId);
});

// 3. Name Map for fallback
const nameMap = new Map();
function normalize(n) { return n ? n.toLowerCase().replace(/[.,&()]/g, ' ').replace(/\s+/g, ' ').trim() : ''; }
for (const [id, data] of Object.entries(idReg)) {
    nameMap.set(normalize(data.canonical_name), id);
    if (data.aliases) data.aliases.forEach(a => nameMap.set(normalize(a), id));
}

let updated = 0;
let unchanged = 0;
let resolvedViaCode = 0;
let failed = 0;

function resolveId(currentId, code, type) {
    // Priority 1: Deterministic Code Match from Master Index
    let masterMatch = null;
    if (type === 'aishe') masterMatch = aisheToId.get(code);
    if (type === 'aicte') masterMatch = aicteToId.get(code);
    if (type === 'josaa') masterMatch = josaaToId.get(code);

    if (masterMatch && idReg[masterMatch]) return masterMatch;

    // Priority 2: Elite Registry Check
    if (type === 'aishe' && eliteAisheToId.has(code)) return eliteAisheToId.get(code);

    // Priority 3: Keep if already valid long ID
    if (idReg[currentId]) return currentId;

    // Priority 4: Name Fallback
    const inferredName = currentId.replace('CORE-', '').replace(/-/g, ' ');
    const matchedId = nameMap.get(normalize(inferredName));
    if (matchedId) return matchedId;

    return null;
}

// Sync JOSAA
for (const code in codeReg.josaa) {
    const currentId = codeReg.josaa[code];
    const newId = resolveId(currentId, code, 'josaa');
    if (newId) {
        if (newId !== currentId) {
            codeReg.josaa[code] = newId;
            updated++;
            if (josaaToId.has(code)) resolvedViaCode++;
        } else {
            unchanged++;
        }
    } else {
        failed++;
    }
}

// Sync AISHE
for (const code in codeReg.aishe) {
    const currentId = codeReg.aishe[code];
    const newId = resolveId(currentId, code, 'aishe');
    if (newId) {
        if (newId !== currentId) {
            codeReg.aishe[code] = newId;
            updated++;
            if (aisheToId.has(code)) resolvedViaCode++;
        } else {
            unchanged++;
        }
    } else {
        failed++;
    }
}

// Sync AICTE
for (const code in codeReg.aicte) {
    const currentId = codeReg.aicte[code];
    const newId = resolveId(currentId, code, 'aicte');
    if (newId) {
        if (newId !== currentId) {
            codeReg.aicte[code] = newId;
            updated++;
            if (aicteToId.has(code)) resolvedViaCode++;
        } else {
            unchanged++;
        }
    } else {
        failed++;
    }
}

console.log(`Sync Summary:`);
console.log(`- Total Entries: ${Object.keys(codeReg.josaa).length + Object.keys(codeReg.aishe).length + Object.keys(codeReg.aicte).length}`);
console.log(`- Updated (Hardened): ${updated}`);
console.log(`- Resolved via Deterministic Code: ${resolvedViaCode}`);
console.log(`- Already Valid / Unchanged: ${unchanged}`);
console.log(`- Still Unresolved: ${failed}`);

fs.writeFileSync(CODE_REG_PATH, JSON.stringify(codeReg, null, 2));
console.log(`Saved hardened registry to ${CODE_REG_PATH}`);
