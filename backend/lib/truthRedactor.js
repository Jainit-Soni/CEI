'use strict';

/**
 * Truth Redactor Engine
 * Clones and strips deep admission truth arrays from page payloads
 * for non-certified institutional tiers (e.g. SEARCH_ONLY).
 *
 * Invariants:
 *   - Never mutates cached objects. All clones use shallow spread.
 *   - Courses are preserved for SEARCH_ONLY (not an admission-critical secret).
 *   - Handles both page-shaped payloads { college: {...} } and direct college objects.
 */

const ADMISSION_TRUTH_ALLOWED_TIERS = new Set(['CERTIFIED_PUBLIC', 'LIMITED_PUBLIC']);

/** Fields to wipe on the college sub-object for non-certified tiers */
const COLLEGE_REDACT_FIELDS = [
    'engineeringCutoffs',
    'engineeringCutoffsSummary',
    'cutoffs',
    'cutoffSummary',
    'seats',
    'seatMatrix',
    'seatMatrixSummary',
    'placements',
    'placementSummary',
    'fees',
    'feeSummary',
];

/** Fields to wipe at the root page envelope level */
const PAGE_REDACT_FIELDS = [
    'placements',
    'placementSummary',
    'fees',
    'feeSummary',
    'seats',
    'seatMatrix',
    'seatMatrixSummary',
    'cutoffs',
    'cutoffSummary',
    'engineeringCutoffs',
    'engineeringCutoffsSummary',
];

/** Safe empty value per field type */
function emptyFor(key) {
    if (key.endsWith('Summary') || key === 'placements' || key === 'fees') return {};
    return [];
}

/**
 * Redacts a page-shaped payload { college: {...}, ...root fields }.
 * Returns a new object — does NOT mutate the original.
 */
function redactCollegePage(page) {
    if (!page) return page;

    // Handle direct college object (no .college wrapper)
    if (!page.college && page.surface_tier !== undefined) {
        return redactCollegeTruth(page);
    }

    const college = page.college;
    if (!college) return page;

    const tier = college.surface_tier;

    // Admission-truth-allowed tiers: preserve all data
    if (ADMISSION_TRUTH_ALLOWED_TIERS.has(tier)) {
        return page;
    }

    // Clone the main page envelope (shallow — no cache mutation)
    const redactedPage = { ...page };

    // Wipe root-level admission truth fields
    for (const field of PAGE_REDACT_FIELDS) {
        if (field in redactedPage) {
            redactedPage[field] = emptyFor(field);
        }
    }

    // Clone and redact the college sub-object
    const redactedCollege = { ...college };
    for (const field of COLLEGE_REDACT_FIELDS) {
        redactedCollege[field] = emptyFor(field);
    }
    // Courses are NOT redacted for SEARCH_ONLY

    redactedPage.college = redactedCollege;
    redactedPage.truth_redacted = true;
    redactedPage.truth_redaction_reason = tier || 'MISSING_SURFACE_TIER';
    return redactedPage;
}

/**
 * Redacts a direct college object (not page-shaped).
 * Returns a new object — does NOT mutate the original.
 */
function redactCollegeTruth(college) {
    if (!college) return college;

    const tier = college.surface_tier;

    // Admission-truth-allowed tiers: preserve all data
    if (ADMISSION_TRUTH_ALLOWED_TIERS.has(tier)) {
        return college;
    }

    const redacted = { ...college };
    for (const field of COLLEGE_REDACT_FIELDS) {
        redacted[field] = emptyFor(field);
    }
    // Courses are NOT redacted for SEARCH_ONLY
    redacted.truth_redacted = true;
    redacted.truth_redaction_reason = tier || 'MISSING_SURFACE_TIER';
    return redacted;
}

module.exports = { redactCollegePage, redactCollegeTruth };
