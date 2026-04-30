/**
 * lib/collegeNormalizer.js
 * ========================
 * Shared runtime schema adapter for standardizing institutions fetched from MongoDB.
 * Reconciles differences between legacy 'id'/'name' formats and new AICTE
 * 'institution_id'/'institution_name' formats directly at the read boundary.
 */

'use strict';

const fs = require('fs');
const path = require('path');

let officialCodes = null;
try {
    const codesPath = path.join(__dirname, '..', 'data', 'truth', 'official_code_registry.json');
    if (fs.existsSync(codesPath)) {
        officialCodes = JSON.parse(fs.readFileSync(codesPath, 'utf8'));
    }
} catch (err) {
    console.error("[Normalizer] Failed to load official code registry:", err.message);
}

function normalizeCollege(raw) {
    if (!raw) return null;

    // 1. Resolve Canonical Identity
    const id = String(
        raw.institution_id || 
        raw.id || 
        raw._id || 
        raw.stableKey || 
        raw.source_stable_key || 
        ""
    );
    
    const stableKey = String(
        raw.source_stable_key || 
        raw.stableKey || 
        raw.stable_import_key || 
        id
    );

    // 2. Resolve Display / Name Fields
    const name = raw.institution_name || raw.name || "Unknown Institute";
    const shortName = raw.shortName || name;

    // 3. Resolve Geography
    const state = raw.state_name || raw.state || raw.state_code || raw.state_value_raw || "";
    const city = raw.district || raw.city || "";
    let location = raw.location;
    if (!location) {
        if (city && state) location = `${city}, ${state}`;
        else location = state || city || "";
    }
    const address = raw.address || location;

    // 4. Resolve Basic Enriched Fields
    const rankingTier = raw.rankingTier || "Tier 3"; // safe fallback
    const isCore = raw.isCore || (id.startsWith('CORE-'));

    // 5. Calculate Identity Confidence
    let confidence = 'LOW';
    let mergeSource = 'name';
    
    if (id.startsWith('CORE-')) {
        let hasCode = false;
        if (officialCodes) {
            // Check if this ID is mapped in ANY official registry
            const inJoSAA = Object.values(officialCodes.josaa || {}).includes(id);
            const inAICTE = Object.values(officialCodes.aicte || {}).includes(id);
            const inAISHE = Object.values(officialCodes.aishe || {}).includes(id);
            if (inJoSAA || inAICTE || inAISHE) hasCode = true;
        }

        if (hasCode) {
            confidence = 'HIGH';
            mergeSource = 'code';
        } else {
            confidence = 'MEDIUM';
            mergeSource = 'geography';
        }
    }

    const identity = {
        canonicalId: id,
        confidence,
        mergeSource,
        strictEligible: confidence === 'HIGH',
        behavior: {
            allowHydration: confidence === 'HIGH',
            allowMerge: confidence === 'HIGH',
            allowUIPromotion: confidence === 'HIGH',
            allowRankingBoost: confidence !== 'LOW',
            searchOnly: confidence === 'LOW'
        }
    };

    // Return the clean adapter representation
    return {
        ...raw, // keep raw fields for backward-compat / truth bridges
        id,
        _id: String(raw._id || id), // ensure _id is stringified for cache stability
        stableKey,
        name,
        shortName,
        state,
        city,
        district: city,
        location,
        address,
        rankingTier,
        isCore,
        identity,
        isVerified: raw.isVerified,
        slug: raw.slug || `/college/${id}`,
        
        // Ensure complex truth shapes exist even if empty
        fees: raw.fees || {},
        placements: raw.placements || {},
        rankings: raw.rankings || [],
        courses: raw.courses || [],
        engineeringCutoffs: raw.engineeringCutoffs || []
    };
}

module.exports = normalizeCollege;
