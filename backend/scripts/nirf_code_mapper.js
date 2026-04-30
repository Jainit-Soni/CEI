const fs = require('fs');
const path = require('path');

const PLACEMENTS_PATH = path.join(__dirname, '../data/truth/nirf_2024_placements.ndjson');
const REGISTRY_PATH = path.join(__dirname, '../data/truth/identity_registry.json');
const OUTPUT_PATH = path.join(__dirname, '../data/truth/nirf_code_linked.ndjson');

function normalize(name) {
    if (!name) return '';
    return name.toUpperCase()
        .replace(/\(.*\)/g, ' ') // Strip parentheses and their contents (e.g., (MNNIT))
        .replace(/[^A-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function mapNirfToCodes() {
    console.log('🔗 Mapping NIRF Placements to CORE IDs via Identity Registry (Aggressive Normalization)...');

    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const placements = fs.readFileSync(PLACEMENTS_PATH, 'utf8')
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

    // Build reverse lookup: normalizedName -> id
    const nameToId = {};
    for (const [id, data] of Object.entries(registry)) {
        nameToId[normalize(data.canonical_name)] = id;
        for (const alias of (data.aliases || [])) {
            const normAlias = normalize(alias);
            if (!nameToId[normAlias]) nameToId[normAlias] = id;
        }
    }

    const linked = [];
    let matchCount = 0;
    let failCount = 0;

    for (const p of placements) {
        let normName = normalize(p.name);
        let id = nameToId[normName];

        // Second pass: try stripping common suffixes/noise
        if (!id) {
            const noiseStripped = normName
                .replace(/UNIVERSITY|INSTITUTE OF TECHNOLOGY|COLLEGE OF ENGINEERING/g, '')
                .trim();
            // This might be too risky, let's stick to nameToId scanning
            for (const [regName, regId] of Object.entries(nameToId)) {
                if (regName.includes(normName) || normName.includes(regName)) {
                   // Only match if high overlap
                   const overlap = Math.abs(regName.length - normName.length);
                   if (overlap < 15) {
                       id = regId;
                       break;
                   }
                }
            }
        }

        if (id) {
            linked.push({
                ...p,
                institution_id: id
            });
            matchCount++;
        } else {
            console.warn(`⚠️ Failed to map: ${p.name} (Norm: ${normName})`);
            failCount++;
        }
    }

    fs.writeFileSync(OUTPUT_PATH, linked.map(l => JSON.stringify(l)).join('\n') + '\n');
    console.log(`✅ NIRF mapping complete! Matched: ${matchCount}, Failed: ${failCount}`);
}

mapNirfToCodes();
