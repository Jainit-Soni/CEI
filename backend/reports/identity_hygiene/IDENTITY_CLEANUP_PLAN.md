
# CEI Identity Cleanup Plan

**Goal**: Sequentially migrate messy or double-prefixed IDs to their canonical forms.

## 1. Audit Summary
- **Total Cases Audited**: 197
- **Safe Records (No Mutation)**: 190
- **Deterministic Rewrite-Ready**: 6
- **Manual Canonical Target Required**: 1
- **Blocker Count**: 0

## 2. Migration Targets (Deterministic)
The following 6 IDs are ready for automated migration:
- `CORE-CORE-IIIT-CHITTOOR` -> `CORE-IIIT-CHITTOOR`
- `CORE-CORE-IIIT-GUWAHATI` -> `CORE-IIIT-GUWAHATI`
- `CORE-CORE-IIIT-KARNATAKA` -> `CORE-IIIT-KARNATAKA`
- `CORE-CORE-IIIT-MANIPUR` -> `CORE-IIIT-MANIPUR`
- `CORE-CORE-IIIT-RAJASTHAN` -> `CORE-IIIT-RAJASTHAN`
- `CORE-CORE-IIIT-TIRUCHIRAPPALLI` -> `CORE-IIIT-TIRUCHIRAPPALLI`

## 3. No-Mutation List
The following IDs will NOT be modified:
- All Safe Records (190 items)
- Unresolved Cases:
  - `CORE-CORE-IIIT-PRADESH` (Resolver output: `CORE-CORE-IIIT-PRADESH`)

## 4. Execution Sequence (Dry-Run Only)
1. **Catalog Update**: Rename `institution_id` and `id` in `institutions` collection.
2. **Truth Alignment**: Update `institution_id` in `seat_matrix` and `engineering_cutoffs`.
3. **Cache Invalidation**: Flush Redis page cache and global dataStore.
4. **Verification**: Rerun `verify_limited_public_truth_surface.js`.

## 5. Rollback Strategy
- Snapshot of `institutions`, `seat_matrix`, and `engineering_cutoffs` must be taken before migration.
- Reversion script: `node backend/tools/rollback_identity_migration.js --snapshot <id>`.

## 6. Required Verification
- `npm run verify:release-surface`
- `node backend/scripts/verify_limited_public_truth_surface.js`
