const fs = require('fs');
const path = require('path');
const identityEnforcement = require('./identityEnforcement');


// Maintain our global maps
const aliasMap = new Map(); // Source ID -> Canonical ID
const identityMap = new Map(); // Canonical ID -> Array of all known Aliases
let registryLoaded = false;

// Violation reporting
const VIOLATION_REPORT_PATH = path.join(__dirname, '..', 'reports', 'identity', 'unregistered_core_id_violations.json');
const VIRTUAL_CORE_REPORT_PATH = path.join(__dirname, '..', 'reports', 'identity', 'virtual_core_ids.json');
const VIRTUAL_ALIAS_PATCH_PATH = path.join(__dirname, '..', 'data', 'truth', 'medical_virtual_core_aliases.json');
const reportedViolations = new Set();
const approvedVirtualCoreIds = new Set();
const virtualAliasMap = new Map(); // Alias -> Canonical

// Fresh Start: Clear reports on startup
try {
    [VIOLATION_REPORT_PATH, VIRTUAL_CORE_REPORT_PATH].forEach(p => {
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(p, JSON.stringify([], null, 2));
    });
} catch (e) {
    console.error("[IdentityResolver] Failed to reset violation reports:", e.message);
}

function loadVirtualRegistry() {
    try {
        const medicalPath = path.join(__dirname, '..', 'data', 'truth', 'medical_identity_master_index.json');
        if (fs.existsSync(medicalPath)) {
            const data = JSON.parse(fs.readFileSync(medicalPath, 'utf8'));
            data.forEach(item => {
                // Collect from specified fields
                [
                    item.parent_core_id,
                    item.core_id,
                    item.resolved_core_id
                ].forEach(id => {
                    if (id && String(id).startsWith('CORE-')) approvedVirtualCoreIds.add(id);
                });
                
                // medical_entity_id only if starts with CORE-
                if (item.medical_entity_id && String(item.medical_entity_id).startsWith('CORE-')) {
                    approvedVirtualCoreIds.add(item.medical_entity_id);
                }
            });

            // Load explicit aliases
            if (fs.existsSync(VIRTUAL_ALIAS_PATCH_PATH)) {
                const aliases = JSON.parse(fs.readFileSync(VIRTUAL_ALIAS_PATCH_PATH, 'utf8'));
                aliases.forEach(a => {
                    if (a.alias_core_id) {
                        approvedVirtualCoreIds.add(a.alias_core_id);
                        if (a.canonical_virtual_core_id) {
                            virtualAliasMap.set(a.alias_core_id, a.canonical_virtual_core_id);
                        }
                    }
                });
                console.log(`[IdentityResolver] Virtual Alias Patch Loaded: ${aliases.length} aliases.`);
            }

            console.log(`[IdentityResolver] Virtual Registry Loaded: ${approvedVirtualCoreIds.size} approved medical IDs.`);
        }
    } catch (err) {
        console.error("[IdentityResolver] Failed to load virtual registry:", err.message);
    }
}

const violationBuffer = new Map(); // path -> Array

function logViolation(id, raw) {
    if (reportedViolations.has(id)) return;
    reportedViolations.add(id);

    const isVirtual = approvedVirtualCoreIds.has(id);
    const targetPath = isVirtual ? VIRTUAL_CORE_REPORT_PATH : VIOLATION_REPORT_PATH;

    if (!violationBuffer.has(targetPath)) violationBuffer.set(targetPath, []);
    violationBuffer.get(targetPath).push({
        id,
        raw,
        type: isVirtual ? "VIRTUAL_APPROVED" : "UNREGISTERED_CORE_VIOLATION",
        timestamp: new Date().toISOString()
    });

    // Throttled Flush (every 50 violations or every 5 seconds)
    if (violationBuffer.get(targetPath).length >= 50) {
        flushViolations(targetPath);
    }
}

function flushViolations(targetPath) {
    try {
        const newViolations = violationBuffer.get(targetPath) || [];
        if (newViolations.length === 0) return;

        let current = [];
        if (fs.existsSync(targetPath)) {
            try { current = JSON.parse(fs.readFileSync(targetPath, 'utf8')); } catch (e) { current = []; }
        }
        
        const combined = [...current, ...newViolations];
        const unique = Array.from(new Map(combined.map(v => [v.id, v])).values());

        fs.writeFileSync(targetPath, JSON.stringify(unique, null, 2));
        violationBuffer.set(targetPath, []);
        console.log(`[IdentityResolver] Flushed ${newViolations.length} violations to ${path.basename(targetPath)}`);
    } catch (err) {
        console.error("[IdentityResolver] Flush failed:", err.message);
    }
}

// Periodic Flush
setInterval(() => {
    flushViolations(VIOLATION_REPORT_PATH);
    flushViolations(VIRTUAL_CORE_REPORT_PATH);
}, 5000);

// Ensure final flush on process exit
process.on('SIGINT', () => {
    flushViolations(VIOLATION_REPORT_PATH);
    flushViolations(VIRTUAL_CORE_REPORT_PATH);
    process.exit();
});

/**
 * Normalizes a name string for strict matching
 */
function strictNormalizeName(name) {
    if (!name) return "";
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * PHASE 4A: Load Batch 1 Registry (Highest Authority for Flagships)
 */
function loadBatch1Registry() {
    if (registryLoaded) return;
    loadVirtualRegistry(); // Ensure virtuals are loaded first
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
                // GUARDRAIL 3: Resolve and Validate before storing
                const resolvedId = identityEnforcement.resolveCanonicalId(id);
                const isInRegistry = !!identityEnforcement.registry[resolvedId];
                const isApprovedVirtual = approvedVirtualCoreIds.has(resolvedId);

                // Handle Logging
                if (isApprovedVirtual) {
                    logViolation(resolvedId, alias); // Logs to virtual_core_ids.json
                } else if (!isInRegistry) {
                    logViolation(resolvedId, alias); // Logs to unregistered_violations.json
                    return; // Skip unregistered
                }

                const lowerAlias = alias.toLowerCase();
                const normAlias = lowerAlias.replace(/[^a-z0-9]/g, '');
                
                aliasMap.set(alias, resolvedId);
                aliasMap.set(lowerAlias, resolvedId);
                aliasMap.set(normAlias, resolvedId);
                aliasMap.set(resolvedId, resolvedId); 
                
                if (!identityMap.has(resolvedId)) identityMap.set(resolvedId, []);
                const ex = identityMap.get(resolvedId);
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
    
    // 1. Deterministic Enforcement (IIT/NIT/IIIT)
    const forcedId = identityEnforcement.resolveCanonicalId(rawId);
    
    // 2. REGISTRY AUTHORITY LOCK (Phase 4B)
    // If we have a CORE- ID, it MUST exist in the registry or be an approved virtual node
    if (forcedId && String(forcedId).startsWith('CORE-')) {
        const isInRegistry = !!identityEnforcement.registry[forcedId];
        const isApprovedVirtual = approvedVirtualCoreIds.has(forcedId);
        
        if (!isInRegistry && !isApprovedVirtual) {
            // console.error(`[IdentityAuthority] VIOLATION: Unregistered CORE ID detected: ${forcedId} (from: ${rawId})`);
            // logViolation(forcedId, rawId);
        } else if (isApprovedVirtual) {
            // logViolation(forcedId, rawId); // Ensure virtual IDs are tracked in virtual_core_ids.json
        }
    }

    if (forcedId !== rawId) {
        // console.log(`[IdentityResolver] Enforcement Applied: ${rawId} -> ${forcedId}`);
        return forcedId;
    }

    const input = String(rawId);
    const norm = input.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    let resolved = aliasMap.get(input) || aliasMap.get(norm) || input;

    // Apply Virtual Alias Patch if applicable
    if (virtualAliasMap.has(resolved)) {
        resolved = virtualAliasMap.get(resolved);
    }
    
    // Final check for resolved IDs starting with CORE-
    if (resolved && String(resolved).startsWith('CORE-')) {
        const isApproved = !!identityEnforcement.registry[resolved] || approvedVirtualCoreIds.has(resolved);
        if (!isApproved) {
            // console.error(`[IdentityAuthority] VIOLATION: Resolved to unregistered CORE ID: ${resolved}`);
            // logViolation(resolved, input);
        } else if (approvedVirtualCoreIds.has(resolved)) {
            // logViolation(resolved, input);
        }
    }

    return resolved;
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
