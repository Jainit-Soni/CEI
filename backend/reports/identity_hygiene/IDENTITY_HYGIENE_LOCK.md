# CEI Identity Hygiene Lock

**Audit Date**: 2026-05-01
**Cohort Size**: 197

## 1. Metrics Baseline
- **Safe Count**: 190
- **Review Count**: 7
- **Blocker Count**: 0
- **Deterministic Rewrite-Ready**: 6
- **Manual Canonical Target Required**: 1
- **AICTE ID Count**: 80

## 2. Deterministic Rewrite Map
The following 6 identities are locked for automated prefix cleanup:
- `CORE-CORE-IIIT-CHITTOOR` -> `CORE-IIIT-CHITTOOR`
- `CORE-CORE-IIIT-GUWAHATI` -> `CORE-IIIT-GUWAHATI`
- `CORE-CORE-IIIT-KARNATAKA` -> `CORE-IIIT-KARNATAKA`
- `CORE-CORE-IIIT-MANIPUR` -> `CORE-IIIT-MANIPUR`
- `CORE-CORE-IIIT-RAJASTHAN` -> `CORE-IIIT-RAJASTHAN`
- `CORE-CORE-IIIT-TIRUCHIRAPPALLI` -> `CORE-IIIT-TIRUCHIRAPPALLI`

## 3. Excluded Anomalies
The following ID is excluded from automated migration due to unresolved canonical resolution:
- **ID**: `CORE-CORE-IIIT-PRADESH`
- **Reason**: Resolver output matches input (no-op cleanup). Requires manual registry verification.

## 4. Warnings & Risk Disclosures
> [!WARNING]
> **NO MUTATION PERFORMED**: This lock document represents a baseline state. No data has been modified in MongoDB.

> [!CAUTION]
> **COHORT DEFINITION**: The public cohort contains 80 AICTE-prefixed identifiers. Stakeholder confirmation is required to verify if these non-elite institutions should remain in the primary release surface.

## 5. Lock Integrity
- **Audit Tool**: `backend/tools/audit_identity_hygiene.js`
- **Verification Hash**: (Reported in final commit)
