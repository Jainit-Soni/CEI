/**
 * backend/lib/surfaceTierRegistry.js
 * ==================================
 * Provides read-only access to the institutional surface tier registry.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '..', 'data', 'truth', 'surface_tiers.json');

let registryData = null;
const tierMap = new Map(); // ID -> Tier Metadata

function loadRegistry() {
    try {
        if (fs.existsSync(REGISTRY_PATH)) {
            const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
            registryData = JSON.parse(raw);
            
            // Flatten nested tiers into a single map for fast lookup
            Object.keys(registryData.tiers).forEach(tierName => {
                registryData.tiers[tierName].forEach(item => {
                    // Store under canonical ID
                    tierMap.set(item.id, item);
                    
                    // Also store under normalized ID (lowercase, no special chars) if different
                    const normId = item.id.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (normId !== item.id) {
                        tierMap.set(normId, item);
                    }
                });
            });
            console.log(`[SurfaceTierRegistry] Loaded ${tierMap.size} institutional mappings.`);
        } else {
            console.warn("[SurfaceTierRegistry] Registry file missing at:", REGISTRY_PATH);
        }
    } catch (err) {
        console.error("[SurfaceTierRegistry] Failed to load registry:", err.message);
    }
}

/**
 * Returns tier metadata for a given ID.
 * Defaults to SEARCH_ONLY if not found.
 */
function getTierMetadata(id) {
    if (!registryData) loadRegistry();
    if (!id) return getDefaultMetadata();

    // Try direct match
    let meta = tierMap.get(id);
    if (meta) return meta;

    // Try normalized match
    const normId = String(id).toLowerCase().replace(/[^a-z0-9]/g, '');
    meta = tierMap.get(normId);
    if (meta) return meta;

    return getDefaultMetadata();
}

function getDefaultMetadata() {
    return {
        surface_tier: "SEARCH_ONLY",
        certified_badge_allowed: false,
        public_listing_visible: false,
        search_visible: true,
        detail_accessible: true,
        release_metrics_included: false,
        reason: "Default (Not in registry)"
    };
}

/**
 * Helpers for API/Route logic
 */
function getSurfaceTier(id) {
    return getTierMetadata(id).surface_tier;
}

function enrichCollegeWithSurfaceTier(college) {
    const id = college.id || college.institution_id || college.college_id;
    const meta = getTierMetadata(id);
    return { ...college, ...meta };
}

function shouldShowInCertifiedListing(college) {
    const id = college.id || college.institution_id || college.college_id;
    return getTierMetadata(id).surface_tier === "CERTIFIED_PUBLIC";
}

function shouldShowInSearch(college) {
    const id = college.id || college.institution_id || college.college_id;
    const meta = getTierMetadata(id);
    return meta.search_visible === true && meta.surface_tier !== "HIDE_UNTIL_HYDRATED";
}

function shouldAllowDetail(college) {
    const id = college.id || college.institution_id || college.college_id;
    return getTierMetadata(id).surface_tier !== "HIDE_UNTIL_HYDRATED";
}

function getTierIds(tierName) {
    if (!registryData) loadRegistry();
    return (registryData.tiers[tierName] || []).map(item => item.id);
}

function getHiddenIds() {
    return getTierIds("HIDE_UNTIL_HYDRATED");
}

module.exports = {
    getTierMetadata,
    getSurfaceTier,
    enrichCollegeWithSurfaceTier,
    shouldShowInCertifiedListing,
    shouldShowInSearch,
    shouldAllowDetail,
    getTierIds,
    getHiddenIds,
    loadRegistry
};
