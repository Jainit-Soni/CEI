
# CEI Public Cohort Definition Audit Report

**Date**: 2026-05-01
**Total Evaluated**: 197
**Verdict**: ⚠️ **DEFINITION_REFINEMENT_REQUIRED**

## 1. Cohort Composition
| Family | Count | Description |
|--------|-------|-------------|
| IIT | 23 | Indian Institute of Technology |
| NIT | 30 | National Institute of Technology |
| IIIT | 9 | Indian Institute of Information Technology |
| GFTI/Govt | 0 | Other JoSAA/State Government Institutions |
| AICTE | 80 | AICTE-only catalog records |
| UNIVERSITY | 8 | University departments |
| OTHER | 47 | Miscellaneous |

## 2. Truth Density Analysis
- **Records with Seats**: 84
- **Records with Cutoffs**: 87
- **Records with Fees**: 197
- **Records with Placements**: 23

### AICTE Issue Summary
- **Total AICTE Records**: 80
- **AICTE Records with NO Truth**: 80
- **Status**: These records are largely "empty shells" that dilute the public cohort quality.

## 3. Recommended Cohort Refinement
- **Current Public Cohort Size**: 197
- **Recommended Public Cohort Size**: 99
- **Recommended to Move to Search-Only**: 98

### Recommendation Breakdown
- **KEEP_PUBLIC_CERTIFIED**: 87
- **KEEP_PUBLIC_LOW_TRUTH**: 12
- **MOVE_TO_SEARCH_ONLY**: 98
- **HIDE_UNTIL_HYDRATED**: 0

## 4. Release Wording Review
**Current Wording**: "Core Engineering institutions (IIT, NIT, IIIT)"
**Status**: **MISLEADING** if AICTE/placeholder records are included.

**Recommended Wording**:
- If refined: "Certified Core Engineering Cohort (IIT, NIT, IIIT, GFTI)"
- If not refined: "Public Engineering Catalog (Including Flagship & AICTE Institutions)"

## 5. Audit Conclusion
The 197-institution cohort contains a high volume (approx 40%) of AICTE placeholders without admission-critical truth. To maintain "Truth-Grade" integrity, these should be removed from the primary public cohort and served via search suggestion/suggestion only until hydration parity is reached.
