const fs = require('fs');
const path = require('path');

/**
 * CEI IDENTITY MASTER BUILDER (V2)
 * 
 * Formalizes identity by collapsing registries and auto-generating missing entities.
 */

const DATA_DIR = path.join(__dirname, '../data/truth');
const ID_REG_PATH = path.join(DATA_DIR, 'identity_registry.json');
const CODE_REG_PATH = path.join(DATA_DIR, 'official_code_registry.json');
const ELITE_REG_PATH = path.join(DATA_DIR, 'elite_identity_registry.json');
const MASTER_INDEX_PATH = path.join(DATA_DIR, 'identity_master_index.json');

const idReg = JSON.parse(fs.readFileSync(ID_REG_PATH, 'utf8'));
const codeReg = JSON.parse(fs.readFileSync(CODE_REG_PATH, 'utf8'));
const eliteReg = JSON.parse(fs.readFileSync(ELITE_REG_PATH, 'utf8'));

console.log('--- STARTING IDENTITY COLLAPSE (V2 - EXHAUSTIVE) ---');

const masterIndex = {
    institutions: {},
    index: {
        aishe: {},
        josaa: {},
        aicte: {},
        names: {}
    }
};

function normalize(n) { 
    return n ? n.toLowerCase().replace(/[.,&()]/g, ' ').replace(/\s+/g, ' ').trim() : ''; 
}

// 1. Initial Load (Primary Registry)
for (const [id, data] of Object.entries(idReg)) {
    masterIndex.institutions[id] = {
        canonical: {
            name: data.canonical_name,
            state: data.state || 'UNKNOWN',
            city: data.city || 'UNKNOWN'
        },
        codes: { aishe: [], josaa: [], aicte: [] },
        aliases: data.aliases || [],
        sources_verified: ['Catalog']
    };
    // Index names
    masterIndex.index.names[normalize(data.canonical_name)] = id;
    if (data.aliases) data.aliases.forEach(a => masterIndex.index.names[normalize(a)] = id);
}

// 2. Resolution Helper
function resolveCanonicalId(currentId, code, type) {
    if (masterIndex.institutions[currentId]) return currentId;

    // Try elite links
    const eliteEntry = eliteReg.find(e => e.aisheCode === code || e.stableKey === code);
    if (eliteEntry && masterIndex.institutions[eliteEntry.canonicalId]) return eliteEntry.canonicalId;

    // Try name match
    const inferredName = currentId.replace('CORE-', '').replace(/-/g, ' ');
    const matchedId = masterIndex.index.names[normalize(inferredName)];
    if (matchedId) return matchedId;

    return null;
}

// 3. Exhaustive Merge
function attachCode(type, code, rawId) {
    let canonicalId = resolveCanonicalId(rawId, code, type);

    if (!canonicalId) {
        // AUTO-GENERATE institution if it's missing but we have a name-like ID
        if (rawId && !rawId.startsWith('aicte:') && !rawId.startsWith('aishe:')) {
            canonicalId = `CORE-${rawId.replace(/\s+/g, '-').toUpperCase()}`;
            if (!masterIndex.institutions[canonicalId]) {
                masterIndex.institutions[canonicalId] = {
                    canonical: {
                        name: rawId.replace(/-/g, ' '),
                        state: 'UNKNOWN',
                        city: 'UNKNOWN'
                    },
                    codes: { aishe: [], josaa: [], aicte: [] },
                    aliases: [],
                    sources_verified: [type.toUpperCase()]
                };
                masterIndex.index.names[normalize(rawId)] = canonicalId;
            }
        } else {
            // Placeholder for raw codes
            canonicalId = `CORE-${type.toUpperCase()}-${code}`;
            if (!masterIndex.institutions[canonicalId]) {
                masterIndex.institutions[canonicalId] = {
                    canonical: {
                        name: `${type.toUpperCase()} Institution ${code}`,
                        state: 'UNKNOWN',
                        city: 'UNKNOWN'
                    },
                    codes: { aishe: [], josaa: [], aicte: [] },
                    aliases: [],
                    sources_verified: [type.toUpperCase()]
                };
            }
        }
    }

    // Attach code to resolved/generated ID
    const inst = masterIndex.institutions[canonicalId];
    if (inst) {
        if (!inst.codes[type].includes(code)) inst.codes[type].push(code);
        masterIndex.index[type][code] = canonicalId;
        return true;
    }
    return false;
}

// Process all sources
let counts = { josaa: 0, aishe: 0, aicte: 0 };
for (const code in codeReg.josaa) if (attachCode('josaa', code, codeReg.josaa[code])) counts.josaa++;
for (const code in codeReg.aishe) if (attachCode('aishe', code, codeReg.aishe[code])) counts.aishe++;
for (const code in codeReg.aicte) if (attachCode('aicte', code, codeReg.aicte[code])) counts.aicte++;

console.log(`Collapse Summary:`);
console.log(`- Institutions: ${Object.keys(masterIndex.institutions).length}`);
console.log(`- JoSAA Linked: ${counts.josaa}`);
console.log(`- AISHE Linked: ${counts.aishe}`);
console.log(`- AICTE Linked: ${counts.aicte}`);

fs.writeFileSync(MASTER_INDEX_PATH, JSON.stringify(masterIndex, null, 2));
console.log(`Master Index saved to: ${MASTER_INDEX_PATH}`);
