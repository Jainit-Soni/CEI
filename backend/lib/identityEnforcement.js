/**
 * backend/lib/identityEnforcement.js
 * ===================================
 * Deterministic Identity Enforcement Layer for CEI.
 * Prevents identity divergence by enforcing canonical short-form IDs
 * for premier engineering cohorts (IIT, NIT, IIIT).
 */

const fs = require('fs');
const path = require('path');

// Load Registry
let registry = {};
try {
    const registryPath = path.join(__dirname, '..', 'data', 'truth', 'identity_registry.json');
    if (fs.existsSync(registryPath)) {
        registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        console.log(`[IdentityRegistry] Authority Layer Loaded: ${Object.keys(registry).length} locked identities.`);
    }
} catch (err) {
    console.error("[IdentityRegistry] Failed to load registry:", err.message);
}

// Build Alias Index for Registry
const nameToId = new Map();
Object.entries(registry).forEach(([id, meta]) => {
    if (meta.canonical_name) nameToId.set(normalize(meta.canonical_name), id);
    if (meta.aliases) {
        meta.aliases.forEach(alias => nameToId.set(normalize(alias), id));
    }
});

// Hardcoded deterministic city-to-canonical mapping
const IIT_CITIES = [
    "BOMBAY", "DELHI", "KANPUR", "KHARAGPUR", "MADRAS", "ROORKEE", "GUWAHATI",
    "HYDERABAD", "INDORE", "BHUBANESWAR", "BHUBANESHWAR", "JODHPUR", "GANDHINAGAR", "PATNA",
    "ROPAR", "MANDI", "VARANASI", "PALAKKAD", "TIRUPATI", "DHANBAD", "BHILAI",
    "GOA", "JAMMU", "DHARWAD"
];

const NIT_CITIES = [
    "TRICHY", "SURATHKAL", "WARANGAL", "ROURKELA", "CALICUT", "KURUKSHETRA",
    "DURGAPUR", "SILCHAR", "JAIPUR", "ALLAHABAD", "JALANDHAR", "SURAT",
    "NAGPUR", "BHOPAL", "JAMSHEDPUR", "AGARTALA", "RAIPUR", "GOA",
    "PATNA", "HAMIRPUR", "UTTARAKHAND", "PUDUCHERRY", "MANIPUR", "SIKKIM",
    "ARUNACHAL-PRADESH", "MEGHALAYA", "MIZORAM", "NAGALAND", "SRINAGAR", "DELHI", "ANDHRA-PRADESH"
];

/**
 * Normalizes input strings for identity resolution
 */
function normalize(str) {
    if (!str) return "";
    return str.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

/**
 * Resolves a canonical ID from a raw name or ID string.
 */
const eliteRegistry = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/truth/elite_institutions.json'), 'utf8'));
const officialCodes = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/truth/official_code_registry.json'), 'utf8'));

// Forbidden patterns for auto-promotion (False Positive Protection)
const FORBIDDEN_PATTERNS = ["education", "international", "academy", "management", "foundation"];

function resolveCanonicalId(input) {
    if (!input) return input;
    
    const raw = String(input);
    const upper = raw.toUpperCase();
    const clean = upper.replace(/[^A-Z0-9]/g, '');

    // 1. IIIT ENFORCEMENT (Must be before IIT because IIIT contains IIT)
    if (upper.includes("INDIAN INSTITUTE OF INFORMATION TECHNOLOGY") || upper.includes("IIIT")) {
        if (upper.includes("VADODARA")) return "CORE-IIIT-VADODARA";
        if (upper.includes("KANCHEEPURAM")) return "CORE-IIIT-KANCHEEPURAM";
        if (upper.includes("JABALPUR")) return "CORE-IIIT-JABALPUR";
        if (upper.includes("GWALIOR")) return "CORE-IIIT-GWALIOR";
        
        // Better city extraction: find the token before "PRADESH" or after "("
        const cleanUpper = upper.replace("HIMACHAL PRADESH", "HIMACHAL-PRADESH").replace("ANDHRA PRADESH", "ANDHRA-PRADESH").replace("MADHYA PRADESH", "MADHYA-PRADESH").replace("UTTAR PRADESH", "UTTAR-PRADESH");
        const parts = cleanUpper.split(/[\s,()]+/);
        
        // Common IIIT Cities
        const IIIT_CITIES = ["KOTA", "GUWAHATI", "KALYANI", "SONEPAT", "UNA", "CHITTOOR", "ALLAHABAD", "MANIPUR", "TIRUCHIRAPPALLI", "LUCKNOW", "DHARWAD", "KURNOOL", "KOTTAYAM", "RANCHI", "NAGPUR", "PUNE", "BHAGALPUR", "BHOPAL", "SURAT", "AGARTALA", "RAICHUR"];
        
        for (const city of IIIT_CITIES) {
            if (upper.includes(city)) return `CORE-IIIT-${city}`;
        }

        const cityPart = parts[parts.length - 1];
        if (cityPart && cityPart.length > 3 && cityPart !== "PRADESH") {
            return `CORE-IIIT-${cityPart.replace(/[^A-Z]/g, '')}`;
        }
    }

    // 2. IIT ENFORCEMENT
    if (upper.includes("INDIAN INSTITUTE OF TECHNOLOGY") || upper.includes("IIT")) {
        for (const city of IIT_CITIES) {
            if (upper.includes(city) || clean.includes(city.replace(/-/g, ''))) {
                const canonicalCity = city === "BHUBANESWAR" ? "BHUBANESHWAR" : city;
                return `CORE-IIT-${canonicalCity}`;
            }
        }
        if (upper.includes("MUMBAI")) return "CORE-IIT-BOMBAY";
    }

    // 3. NIT ENFORCEMENT
    if (upper.includes("NATIONAL INSTITUTE OF TECHNOLOGY") || upper.includes("NIT")) {
        if (upper.includes("TIRUCHIRAPPALLI") || upper.includes("TIRUCHIRAPALLI")) return "CORE-NIT-TRICHY";
        if (upper.includes("SURATHKAL") || upper.includes("KARNATAKA")) return "CORE-NIT-SURATHKAL";
        for (const city of NIT_CITIES) {
            if (upper.includes(city) || clean.includes(city.replace(/-/g, ''))) {
                return `CORE-NIT-${city}`;
            }
        }
    }

    // 4. CHECK REGISTRY (IMMUTABLE LOCK for non-elites)
    if (registry[raw]) return raw;
    const normInput = normalize(raw);
    if (nameToId.has(normInput)) return nameToId.get(normInput);

    // 5. VERBOSE ID CLEANUP
    if (upper.startsWith("CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-")) {
        const city = upper.replace("CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-", "");
        return `CORE-IIT-${city}`;
    }
    if (upper.startsWith("CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-")) {
        const city = upper.replace("CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-", "");
        return `CORE-NIT-${city}`;
    }

    return input;
}

/**
 * INGESTION HOOK: Validate before creation/update (Phase 4B Lock Rule)
 */
function validateForIngestion(institution, existingDoc = null) {
    const name = institution.name || institution.institution_name;
    const state = institution.state || institution.state_name;
    const incomingId = institution.id || institution.institution_id;

    // RULE 4.1: If institution_id exists in DB, it CANNOT be modified (Canonical ID Lock)
    if (existingDoc && existingDoc.institution_id && incomingId) {
        if (existingDoc.institution_id !== incomingId) {
            return {
                canInsert: false,
                reason: "LOCK_VIOLATION: institution_id is immutable",
                expectedId: existingDoc.institution_id,
                receivedId: incomingId
            };
        }
    }

    // RULE 4.2: Check Registry for exact match
    const resolvedId = resolveCanonicalId(name || incomingId);
    
    // RULE 5.1: QUARANTINE MODE - No new CORE-* IDs without registry entry
    if (resolvedId.startsWith('CORE-') && !registry[resolvedId]) {
        const source = institution.source || institution.source_type || 'unverified';
        const isOfficial = ['josaa', 'nirf', 'aicte', 'mcc'].includes(source.toLowerCase());
        
        // --- NAME FILTER (RULE 4) ---
        const lowerName = name.toLowerCase();
        const hasForbiddenPattern = FORBIDDEN_PATTERNS.some(p => lowerName.includes(p));

        // --- SCORING ENGINE (Phase 4C) ---
        const frequency = (institution.frequency || 1);
        const nameMatchConfidence = (normalize(name) === name.toUpperCase().replace(/[^A-Z0-9]/g, '')) ? 20 : 10;
        
        const frequencyWeight = frequency > 10 ? 40 : (frequency * 4);
        const authorityWeight = isOfficial ? 40 : 0;
        
        let approvalScore = frequencyWeight + authorityWeight + nameMatchConfidence;

        // --- OFFICIAL CODE VALIDATION (Phase 4E) ---
        let hasVerifiedCode = false;
        const josaaCode = institution.josaa_code || institution.josaaId;
        const aicteId = institution.aicte_id || institution.aicteId;
        const aisheCode = institution.aishe_code || institution.aisheCode;

        if (josaaCode && officialCodes.josaa[josaaCode] === resolvedId) hasVerifiedCode = true;
        if (aicteId && officialCodes.aicte[aicteId] === resolvedId) hasVerifiedCode = true;
        if (aisheCode && officialCodes.aishe[aisheCode] === resolvedId) hasVerifiedCode = true;

        // --- ELITE VALIDATION (Phase 4D) ---
        let isEliteVerified = false;
        if (resolvedId.startsWith('CORE-IIT-') || resolvedId.startsWith('CORE-NIT-') || resolvedId.startsWith('CORE-IIIT-')) {
            const parts = resolvedId.split('-');
            const type = parts[1]; // IIT/NIT/IIIT
            const city = parts.slice(2).join('-'); // e.g. BOMBAY
            if (eliteRegistry[type] && eliteRegistry[type].includes(city)) {
                // If it's an elite claim, we STRONGLY prefer a verified code
                if (hasVerifiedCode) isEliteVerified = true;
            }
        }

        // FALLBACK RULE (Phase 4E): If no verified code available, cap score to 60
        if (!hasVerifiedCode || hasForbiddenPattern) {
            approvalScore = Math.min(approvalScore, 60);
        }

        // ELITE LOCK: Elite claims MUST be verified or they are capped even harder
        if ((resolvedId.startsWith('CORE-IIT-') || resolvedId.startsWith('CORE-NIT-')) && !isEliteVerified) {
            approvalScore = Math.min(approvalScore, 40);
        }

        return {
            canInsert: false,
            status: "quarantine",
            reason: hasForbiddenPattern ? "INVALID_ELITE_PATTERN" : (hasVerifiedCode ? "UNREGISTERED_CORE_ID" : "MISSING_OFFICIAL_CODE"),
            suggestedId: resolvedId,
            approvalScore: approvalScore,
            metadata: {
                raw_input: name,
                attempted_id: incomingId,
                normalized_name: normalize(name),
                state: state,
                source_types: [source],
                josaa_code: josaaCode,
                aicte_id: aicteId,
                aishe_code: aisheCode,
                name_confidence_score: nameMatchConfidence,
                approval_score: approvalScore,
                is_elite_verified: isEliteVerified,
                has_verified_code: hasVerifiedCode,
                first_seen: institution.first_seen || new Date(),
                last_seen: new Date()
            }
        };
    }

    // RULE 5.2: No duplicate normalized name + state
    const normName = normalize(name);
    const existingRegistryId = nameToId.get(normName);
    if (existingRegistryId) {
        const meta = registry[existingRegistryId];
        if (state && meta.state && normalize(state) === normalize(meta.state)) {
            if (incomingId && incomingId !== existingRegistryId) {
                return {
                    canInsert: false,
                    reason: "DUPLICATE_IDENTITY: Name + State match existing registry entry",
                    existingId: existingRegistryId
                };
            }
        }
    }
    
    return { 
        canInsert: true,
        resolvedId: resolvedId 
    };
}

function validateInstitutionId(id, name) {
    const canonical = resolveCanonicalId(name || id);
    const isValid = id === canonical;
    if (!isValid) {
        console.warn(`[IdentityAuthority] ID Mismatch: ${id} should be ${canonical}`);
    }
    return {
        isValid,
        canonicalId: canonical
    };
}

module.exports = {
    resolveCanonicalId,
    validateInstitutionId,
    validateForIngestion,
    normalize,
    registry
};

