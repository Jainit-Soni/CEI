
# Certified Public Cohort Split Plan

**Date**: 2026-05-01
**Cohort Size**: 197
**Verdict**: ✅ **COHORT_SPLIT_READY_FOR_REVIEW**

## 1. Metrics Baseline
- **Current Public Cohort**: 197
- **Proposed Certified Public Cohort**: 77
- **Proposed Search-Only Count**: 111
- **Certified-Safe-With-Full-Truth**: 84
- **Manual Review Pending**: 9

## 2. The Gap Calculation (Explanation)
- **Keep Count**: 77 (IIT/NIT/IIIT/GFTI with some truth)
- **Full Truth Count**: 84 (All institutions with seats + cutoffs)

This means there are 9 records that have full truth but are NOT in the flagship families (e.g. state universities or private colleges accidentally in the 197 pool).

### Gap Institutions (Elite with Partial Truth)
- **CORE IIIT KARNATAKA** (IIIT): Seats: false, Cutoffs: true
- **CORE IIIT RAJASTHAN** (IIIT): Seats: false, Cutoffs: true

## 3. Strict Classification Rules
- **KEEP_PUBLIC_CERTIFIED**: Elite/GFTI family AND Full Admission Truth (Seats + Cutoffs).
- **KEEP_PUBLIC_LOW_TRUTH**: Elite/GFTI flagship family AND Partial Admission Truth (Seats OR Cutoffs).
- **MOVE_TO_SEARCH_ONLY**: AICTE placeholders, no truth data, or non-elite without truth.
- **NEEDS_MANUAL_REVIEW**: Non-elite with truth available (Pending inclusion policy).

## 4. Final Recommended Release Wording
**"Certified Core Engineering Cohort: IITs, NITs, IIITs and selected GFTIs with verified admission truth"**

## 5. Summary Statistics
| Category | Count |
|----------|-------|
| IIT | 23 |
| NIT | 31 |
| IIIT | 32 |
| GFTI | 14 |
| AICTE | 80 |
| UNIVERSITY | 2 |
| OTHER | 15 |
