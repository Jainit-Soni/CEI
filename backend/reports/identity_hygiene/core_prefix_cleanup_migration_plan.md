
# Identity Migration Plan: CORE-CORE Cleanup

**Date**: 2026-05-01
**Mode**: APPLY
**Status**: EXECUTED

## 1. Migration Summary
- **Target Identities**: 6
- **Total Affected Documents**: 6
- **Excluded Identities**: 1 (CORE-CORE-IIIT-PRADESH)

## 2. Detailed Impact Matrix
| Old ID | New ID | Inst | Seats | Cutoffs | Colleges |
|--------|--------|------|-------|---------|----------|
| CORE-CORE-IIIT-CHITTOOR | CORE-IIIT-CHITTOOR | 1 | 0 | 0 | 0 |
| CORE-CORE-IIIT-GUWAHATI | CORE-IIIT-GUWAHATI | 1 | 0 | 0 | 0 |
| CORE-CORE-IIIT-KARNATAKA | CORE-IIIT-KARNATAKA | 1 | 0 | 0 | 0 |
| CORE-CORE-IIIT-MANIPUR | CORE-IIIT-MANIPUR | 1 | 0 | 0 | 0 |
| CORE-CORE-IIIT-RAJASTHAN | CORE-IIIT-RAJASTHAN | 1 | 0 | 0 | 0 |
| CORE-CORE-IIIT-TIRUCHIRAPPALLI | CORE-IIIT-TIRUCHIRAPPALLI | 1 | 0 | 0 | 0 |

## 3. Safety Measures
- **Deterministic Match**: Updates only apply to exact matches of `id`, `institution_id`, or `stableKey`.
- **No Fuzzy Matching**: No name-based or partial-string updates performed.
- **Rollback Path**: Snapshots must be restored from `snapshots/pre_migration/` if errors occur.

## 4. Post-Migration Verification
Run the following after applying:
1. `npm run verify:release-surface`
2. `node backend/scripts/verify_limited_public_truth_surface.js`
3. `node backend/tools/audit_identity_hygiene.js --cohort public --limit ALL`
