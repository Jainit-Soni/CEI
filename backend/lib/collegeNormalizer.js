/**
 * lib/collegeNormalizer.js
 * ========================
 * Shared runtime schema adapter for standardizing institutions fetched from MongoDB.
 * Reconciles differences between legacy 'id'/'name' formats and new AICTE
 * 'institution_id'/'institution_name' formats directly at the read boundary.
 */

'use strict';

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
