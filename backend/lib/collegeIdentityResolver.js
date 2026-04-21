const fs = require('fs');
const path = require('path');

// Maintain our global maps
const aliasMap = new Map(); // Source ID -> Canonical ID
const identityMap = new Map(); // Canonical ID -> Array of all known Aliases
let registryLoaded = false;

/**
 * Normalizes a name string for strict matching
 */
function strictNormalizeName(name) {
    if (!name) return "";
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * PHASE 4A: Load Batch 1 Registry (Highest Authority for Flagships)
 * This must be available globally for resolveCanonicalId to work before/during hydration.
 */
function loadBatch1Registry() {
    if (registryLoaded) return;
    try {
        const b1Path = path.join(__dirname, '..', 'data', 'truth', 'core_id_mapping_batch1.json');
        if (fs.existsSync(b1Path)) {
            const registry = JSON.parse(fs.readFileSync(b1Path, 'utf8'));
            const fullMap = { 
                ...registry.engineering_map, 
                ...registry.mcc_map,
                "All India Institute of Medical Sciences Delhi": "CORE-AIIMS-DELHI",
                "All India Institute of Medical Sciences New Delhi": "CORE-AIIMS-DELHI"
            };
            
            Object.entries(fullMap).forEach(([alias, id]) => {
                const lowerAlias = alias.toLowerCase();
                const normAlias = lowerAlias.replace(/[^a-z0-9]/g, '');
                
                // Map every variant to the stable CORE ID
                aliasMap.set(alias, id);
                aliasMap.set(lowerAlias, id);
                aliasMap.set(normAlias, id);
                aliasMap.set(id, id); // Self-reference for ID stability
                
                if (!identityMap.has(id)) identityMap.set(id, []);
                const ex = identityMap.get(id);
                if (!ex.includes(alias)) ex.push(alias);
            });
            console.log(`[IdentityResolver] Batch 1 Registry Offline-Loaded: ${aliasMap.size} rules.`);
        }
    } catch (err) {
        console.error("[IdentityResolver] Failed to load Batch 1 Registry:", err.message);
    }
    registryLoaded = true;
}

/**
 * Builds deterministic mappings based on catalog institutions and available truth.
 */
function buildIdentityMaps(catalogInstitutions, externalTruthRecords) {
    loadBatch1Registry(); // Ensure registry is present
    
    const ambiguousNames = new Set();
    const nameToCandidate = new Map(); 

    // First scan to determine name uniqueness
    catalogInstitutions.forEach(c => {
        const cId = String(c.institution_id || c.id || c._id || "");
        if (!cId) return;

        const aliases = new Set([
            cId,
            String(c._id || ""),
            c.stableKey,
            c.aisheCode
        ].filter(Boolean).map(String));

        aliases.forEach(alias => {
            if (!aliasMap.has(alias)) aliasMap.set(alias, cId);
        });
        
        if (!identityMap.has(cId)) identityMap.set(cId, Array.from(aliases));

        const normName = strictNormalizeName(c.institution_name || c.name);
        if (normName) {
            if (nameToCandidate.has(normName)) {
                ambiguousNames.add(normName);
            } else {
                nameToCandidate.set(normName, {
                    cId,
                    state: strictNormalizeName(c.state_name || c.state),
                    city: strictNormalizeName(c.district || c.city)
                });
            }
        }
    });

    const collisionReport = { resolved: 0, unresolved: 0, ambiguous: 0, log: [] };

    // Map external truth records deterministically
    externalTruthRecords.forEach(truth => {
        const tId = truth.collegeId || truth.stableKey || truth.id;
        if (!tId) return;

        if (aliasMap.has(tId)) {
            collisionReport.resolved++;
            return;
        }

        const tName = strictNormalizeName(truth.name || truth.institution_name);
        if (tName && aliasMap.has(tName)) {
            aliasMap.set(tId, aliasMap.get(tName));
            collisionReport.resolved++;
            return;
        }

        if (tName && nameToCandidate.has(tName)) {
            if (ambiguousNames.has(tName)) {
                collisionReport.ambiguous++;
                return;
            }

            const candidate = nameToCandidate.get(tName);
            const tState = strictNormalizeName(truth.state);
            const tCity = strictNormalizeName(truth.city || truth.district);

            let corroborated = false;
            if (tState && candidate.state && tState === candidate.state) corroborated = true;
            if (tCity && candidate.city && tCity === candidate.city) corroborated = true;

            if (corroborated) {
                aliasMap.set(tId, candidate.cId);
                collisionReport.resolved++;
                return;
            }
        }
        collisionReport.unresolved++;
    });

    return { aliasMap, identityMap, collisionReport };
}

function resolveCanonicalId(rawId) {
    if (!rawId) return rawId;
    if (!registryLoaded) loadBatch1Registry();
    const input = String(rawId);
    const norm = input.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    return aliasMap.get(input) || aliasMap.get(norm) || input;
}

function getAllAliases(canonicalId) {
    const cId = resolveCanonicalId(canonicalId);
    return identityMap.get(cId) || [cId];
}

module.exports = {
    buildIdentityMaps,
    resolveCanonicalId,
    getAllAliases
};
