# Identity Prefix Cleanup: Apply Report

**Date**: 2026-05-01
**Migration Status**: ✅ EXECUTED

## 1. Applied Mappings (N=6)
The following 6 identities were successfully migrated to their canonical forms:
- `CORE-CORE-IIIT-CHITTOOR` -> `CORE-IIIT-CHITTOOR`
- `CORE-CORE-IIIT-GUWAHATI` -> `CORE-IIIT-GUWAHATI`
- `CORE-CORE-IIIT-KARNATAKA` -> `CORE-IIIT-KARNATAKA`
- `CORE-CORE-IIIT-MANIPUR` -> `CORE-IIIT-MANIPUR`
- `CORE-CORE-IIIT-RAJASTHAN` -> `CORE-IIIT-RAJASTHAN`
- `CORE-CORE-IIIT-TIRUCHIRAPPALLI` -> `CORE-IIIT-TIRUCHIRAPPALLI`

## 2. Document Metrics
- **Total Processed**: 6
- **Total Modified Documents**: 6 (all in `institutions` collection)
- **Skipped/Excluded**: 1 (`CORE-CORE-IIIT-PRADESH`)

## 3. Route & Identity Verification
- **New Canonical Routes**: Verified. IDs like `CORE-IIIT-CHITTOOR` resolve correctly in the database.
- **Legacy Fallback**: The `collegeIdentityResolver` continues to map old `CORE-CORE-` prefixes to the new canonical IDs in memory, ensuring zero broken links for existing bookmarks or external truth links.
- **Truth Persistence**: Regression guards confirm that seat and cutoff data for these institutions remains correctly linked.

## 4. Post-Migration Audit (N=197)
- **SAFE**: 196
- **REVIEW**: 1 (`CORE-CORE-IIIT-PRADESH`)
- **BLOCKER**: 0
- **Final Verdict**: ✅ **IDENTITY_HYGIENE_STABLE**

## 5. Safety & Rollback
- **Pre-Migration Snapshot**: `backend/reports/identity_hygiene/pre_core_prefix_cleanup_snapshot.ndjson`
- **Rollback Path**: Restore the snapshot if needed. No destructive deletions were performed.
