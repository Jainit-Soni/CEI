# CEI Surface Tier Lock Report

**Date**: 2026-05-01
**Status**: 🔒 LOCKED
**Verdict**: ✅ **SURFACE_TIER_PLAN_READY_FOR_REVIEW**

## 1. Final Tier Metrics (N=197)
| Tier | Count | Description | Listing | Search | Detail | Badge |
|------|-------|-------------|---------|--------|--------|-------|
| **CERTIFIED_PUBLIC** | 75 | Elite/GFTI flagships with full truth (Seats + Cutoffs) | YES | YES | YES | YES |
| **PUBLIC_REVIEW** | 11 | Partial flagships (Gap cases) OR Full non-flagships | NO | YES | YES | NO |
| **SEARCH_ONLY** | 110 | Catalog placeholders / AICTE shells / No truth | NO | YES | YES | NO |
| **HIDE_UNTIL_HYDRATED** | 1 | Identity anomalies / Unsafe records | NO | NO | NO | NO |

## 2. Arithmetic Reconciliation (Verification)
- **Flagship + Full Truth**: 75
- **Flagship + Partial Truth**: 2 (`CORE IIIT KARNATAKA`, `CORE IIIT RAJASTHAN`)
- **Non-Flagship + Full Truth**: 9
- **Total Flagships Identified**: 77
- **Total Records in 197 Cohort**: 197

## 3. Implementation Guardrails
- **Certified Metrics**: Coverage and parity metrics apply ONLY to the 75 `CERTIFIED_PUBLIC` institutions.
- **Search Discoverability**: `SEARCH_ONLY` records remain discoverable via search to maintain platform scale, but do not receive the "Certified" status.
- **Visibility Enforcement**: `HIDE_UNTIL_HYDRATED` records (currently 1) are strictly excluded from all public API endpoints.
- **Badge Integrity**: The "Certified" badge is exclusively reserved for the 75 `CERTIFIED_PUBLIC` institutions.

## 4. Release Wording (Official)
**"Certified Engineering Admission Cohort: IITs, NITs, IIITs and selected GFTIs with verified admission truth."**

## 6. Technical Mapping Clarification
- **Observed Mapping Count (394)**: The `SurfaceTierRegistry` log reports 394 mappings. This represents the 197 primary institutional IDs plus 197 normalized aliases (lowercase and alphanumeric-only) generated for resilient lookup.
- **Ratio**: 197 primary records * 2 (Canonical + Normalized) = 394 mappings.
- **Resolution**: This is an intended feature of the `SurfaceTierRegistry` lookup layer and confirms 100% alias coverage for the public cohort.

## 7. Audit Compliance
- Registry: `backend/data/truth/surface_tiers.json`
- Enforcement: `backend/lib/collegeNormalizer.js` and `backend/routes/colleges.js`
- Audit Script: `backend/tools/audit_surface_tier_exposure.js`
