# CEI Limited Public Release Checkpoint

**Audit Date**: 2026-05-01
**Verdict**: ✅ LIMITED_PUBLIC_COHORT_READY

This document certifies that the CEI platform is ready for limited public release targeting the **Core Engineering public cohort**.

## 1. Certified Scope
- **Certified Cohort**: 197 Core Engineering institutions (IIT, NIT, IIIT).
- **Hardened Surface**: Frontend is free of known hardcoded numeric blockers.
- **Truth Parity**: High-fidelity seats and cutoffs surfaced for the certified cohort.
- **Milestone Lock**: Regression guards active and committed (Commit: `a4853572`).

## 2. Explicit Non-Certified Scope
- **Broader Catalog**: ~20,000+ Non-Core institutions (Discovery risk).
- **AISHE Base**: 67,000+ total institutions (Tactical/Unlinked).
- **Medical/MCC**: Coverage remains incomplete and in-progress.
- **Fees/Placements**: Coverage varies; certified only where verified numeric data is present.
- **Number Review**: 79 lower-risk factual constants remain for future API linkage.
- **DB Truth**: Full database provenance audit beyond the 197-node cohort is not certified.

## 3. Core Metrics (Certified Cohort N=197)

| Metric | Value |
| :--- | :--- |
| **Public Cohort Size** | 197 |
| **Location Coverage** | 100.00% |
| **Seats Coverage** | ~56% |
| **Cutoffs Coverage** | ~44% |
| **CEI Score Coverage** | ~97% |
| **Number Blocker Count** | **0** |
| **Remaining Review Items** | **79** |

## 4. Operational & CI Verification
The following commands were executed and **PASSED** on 2026-05-01:
- `npm run verify:release-surface`
- `npm run audit:provenance-surface`
- `node backend/tools/audit_frontend_visible_data_inventory.js --cohort public`

## 5. Technical Debt & Risks
- **Identity Hygiene**: Residual CORE-CORE prefix handling requires migration to canonical IDs.
- **Fees Density**: Fee recovery is limited to 16 certified nodes.
- **Marketing Claims**: Platform-scale claims (12k+) have been neutralized but require live API backing for future audits.
- **Stale Cache**: Cache invalidation is required upon every truth-grade data update.

## 6. Frontend Provenance & Freshness Audit (Truth-Grade)
- **Verdict**: ✅ PROVENANCE_SURFACE_SAFE_FOR_LIMITED_PUBLIC_COHORT_WITH_REVIEWS
- **Audited Institutions**: 197 (Public Cohort)
- **Admission-Critical Blockers**: 191 (Note: All blockers are CEI Score internal calculations)
- **Total Rendered Sections (with data)**: 420
  - *Note: Refers to unique college-section truth surfaces found (110 seats + 88 cutoffs + 16 fees + 15 placements + 191 ceiScores).*
- **Provenance Coverage (Rendered)**: 100% (Full, Partial, or API-only)
- **Freshness Coverage (Rendered)**: 100% (Excluding internal scores)
- **Known Reviews**: 141 (Seats, Fees, and Placements require source URL linkage)
- **Detailed Report**: [PROVENANCE_FRESHNESS_AUDIT.md](file:///E:/CMAT-PROBLEM/backend/reports/frontend_provenance_freshness/PROVENANCE_FRESHNESS_AUDIT.md)

## 7. Rollback & Recovery
- **Latest Safe Commit**: `718b4a2f`
- **Reversion Target**: [walkthrough.md](file:///C:/Users/Jainit%20Soni/.gemini/antigravity/brain/e0c7ce2c-36d1-4858-8493-3f02d819d607/walkthrough.md)
- **Guards**: Rerun `verify_no_numeric_truth_blockers.js` to ensure no regression in truth surface.

---

> [!WARNING]
> **FINAL RELEASE WARNING**: This checkpoint certifies ONLY the limited public frontend surface for the 197-node Core cohort. It does NOT certify the full CEI database, full catalog, or all source provenance.
