
# Identity Cleanup Dry-Run Report (Hardened)

**Date**: 2026-05-01
**Verdict**: ✅ DRY_RUN_READY_FOR_MIGRATION_SCRIPT

## 1. Summary
- **Targets Evaluated**: 6
- **Sources Found**: 6
- **Collision Risks**: 0
- **Total Affected Documents**: 6
- **Explicitly Excluded**: CORE-CORE-IIIT-PRADESH

## 2. Collection Impact
- **colleges**: 0 documents
- **institutions**: 6 documents
- **seat_matrix**: 0 documents
- **engineering_cutoffs**: 0 documents

## 3. Detail Matrix
| Source | Target | Status | Inst | Seats | Cutoffs | Collisions |
|--------|--------|--------|------|-------|---------|------------|
| CORE-CORE-IIIT-CHITTOOR | CORE-IIIT-CHITTOOR | READY | 1 | 0 | 0 | 0 |
| CORE-CORE-IIIT-GUWAHATI | CORE-IIIT-GUWAHATI | READY | 1 | 0 | 0 | 0 |
| CORE-CORE-IIIT-KARNATAKA | CORE-IIIT-KARNATAKA | READY | 1 | 0 | 0 | 0 |
| CORE-CORE-IIIT-MANIPUR | CORE-IIIT-MANIPUR | READY | 1 | 0 | 0 | 0 |
| CORE-CORE-IIIT-RAJASTHAN | CORE-IIIT-RAJASTHAN | READY | 1 | 0 | 0 | 0 |
| CORE-CORE-IIIT-TIRUCHIRAPPALLI | CORE-IIIT-TIRUCHIRAPPALLI | READY | 1 | 0 | 0 | 0 |

## 4. Rollback Snapshot Plan
Before any actual migration, a mandatory snapshot command must be run:
```bash
# Mandatory snapshot commands
mongodump --db cei_v2 --collection institutions --out snapshots/pre_migration/
mongodump --db cei_v2 --collection seat_matrix --out snapshots/pre_migration/
mongodump --db cei_v2 --collection engineering_cutoffs --out snapshots/pre_migration/
```

## 5. Verification
> [!IMPORTANT]
> This was a **dry-run only**. No documents were modified in MongoDB.
