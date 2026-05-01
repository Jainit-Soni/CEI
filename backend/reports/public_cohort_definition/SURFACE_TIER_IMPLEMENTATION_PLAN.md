# Surface-Tier Implementation Plan

**Date**: 2026-05-01
**Cohort Size**: 197
**Verdict**: ✅ **SURFACE_TIER_PLAN_READY_FOR_REVIEW**

## 1. Surface Tier Definitions
| Tier | Count | Description | Listing | Search | Detail | Badge | Metrics |
|------|-------|-------------|---------|--------|--------|-------|---------|
| **CERTIFIED_PUBLIC** | 75 | Full-truth IIT/NIT/IIIT/GFTI counselling institutions. | YES | YES | YES | YES | YES |
| **PUBLIC_REVIEW** | 11 | Flagships with partial truth OR non-flagships with full truth. | NO | YES | YES | NO | NO |
| **SEARCH_ONLY** | 110 | Catalog placeholders, AICTE shells, no admission truth. | NO | YES | YES | NO | NO |
| **HIDE_UNTIL_HYDRATED**| 1 | Ambiguous identity or unsafe for public view. | NO | NO | NO | NO | NO |

## 2. Arithmetic Reconciliation
The "Keep" count of 77 and "Full Truth" count of 84 are reconciled as follows:

| Metric | Flagship (IIT/NIT/IIIT/GFTI) | Non-Flagship (Private/Univ/AICTE) | Total |
|--------|------------------------------|-----------------------------------|-------|
| **Full Truth** (S+C) | **75** (CERTIFIED_PUBLIC) | **9** (PUBLIC_REVIEW) | **84** |
| **Partial Truth** (S/C)| **2** (PUBLIC_REVIEW) | 0 | 2 |
| **No Truth** | 0 | 111 (SEARCH_ONLY + HIDE) | 111 |
| **Total** | **77** (The "Keep" Pool) | **120** | **197** |

- **77 Keep** = 75 Certified + 2 Partial Flagships.
- **84 Full Truth** = 75 Certified + 9 Non-Flagship Full Truth.

## 3. Implementation Rules
- **Certified Metrics**: Apply ONLY to `CERTIFIED_PUBLIC`.
- **Public Listing**: Only `CERTIFIED_PUBLIC` appears in the primary registry/landing pages.
- **Search Discoverability**: `SEARCH_ONLY` and `PUBLIC_REVIEW` are discoverable via search but do not receive the certified badge.
- **Access Control**: `HIDE_UNTIL_HYDRATED` is blocked at the route level unless a debug flag is present.

## 4. Official Release Wording
“Certified Engineering Admission Cohort: IITs, NITs, IIITs and selected GFTIs with verified admission truth.”
