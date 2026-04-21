const fs = require('fs');
const path = require('path');

let mapping = null;
const aliasMap = new Map();

/**
 * Loads the Batch 1 mapping registry and builds a strict alias-to-canonical-ID map.
 */
function loadMapping() {
    try {
        const mappingPath = path.resolve(__dirname, '../data/truth/core_id_mapping_batch1.json');
        if (!fs.existsSync(mappingPath)) {
            console.error(`[IdentityResolver] Mapping file not found: ${mappingPath}`);
            return;
        }

        const data = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        aliasMap.clear();

        // 1. Map canonical IDs (case-insensitive and normalized)
        const canonicalIds = new Set([
            ...Object.values(data.engineering_map),
            ...Object.values(data.mcc_map)
        ]);

        canonicalIds.forEach(id => {
            const lowerId = id.toLowerCase();
            const normId = lowerId.replace(/[^a-z0-9]/g, '');
            aliasMap.set(lowerId, id);
            aliasMap.set(normId, id);
        });

        // 2. Map aliases and legacy names from engineering_map
        Object.entries(data.engineering_map).forEach(([alias, id]) => {
            const lowerAlias = alias.toLowerCase();
            const normAlias = lowerAlias.replace(/[^a-z0-9]/g, '');
            
            // Do not overwrite a canonical ID match if it already exists
            if (!aliasMap.has(lowerAlias)) aliasMap.set(lowerAlias, id);
            if (!aliasMap.has(normAlias)) aliasMap.set(normAlias, id);
        });

        // 3. Map MCC IDs
        Object.entries(data.mcc_map).forEach(([mccId, id]) => {
            const lowerMcc = mccId.toLowerCase();
            aliasMap.set(lowerMcc, id);
        });

        mapping = data;
        console.log(`[IdentityResolver] Batch 1 Registry loaded. ${aliasMap.size} unique resolution targets indexed.`);
    } catch (error) {
        console.error('[IdentityResolver] Failed to load mapping:', error);
    }
}

/**
 * Resolves a given ID or alias string to the canonical Batch 1 institution ID.
 * Returns null if the identity is unknown to the registry.
 */
function resolveId(idOrAlias) {
    if (!mapping) loadMapping();
    if (!idOrAlias) return null;

    const input = idOrAlias.toLowerCase();
    
    // Check direct match (includes lower-cased canonicals and aliases)
    if (aliasMap.has(input)) return aliasMap.get(input);

    // Check normalized match (strips non-alphanumeric for resilient routing)
    const normalizedInput = input.replace(/[^a-z0-9]/g, '');
    if (aliasMap.has(normalizedInput)) return aliasMap.get(normalizedInput);

    return null;
}

module.exports = { resolveId };
