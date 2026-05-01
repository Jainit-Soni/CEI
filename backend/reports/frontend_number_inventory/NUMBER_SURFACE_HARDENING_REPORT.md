# CEI Frontend Number Hardening Report

**Audit Date**: 2026-05-01
**Status**: COMPLETED
**Verdict**: NUMBER_SURFACE_NEEDS_REVIEW

## 1. Executive Summary
Critical hardcoded marketing placeholders and unproven factual claims have been surgically removed or neutralized across the CEI frontend. The platform now defaults to neutral "Pending Verification" states or dynamic API-backed values where available. The CEI frontend is now hardened against unproven numeric claims, ensuring that no known hardcoded numeric blocker claims remain on the frontend number surface.

**Reasoning**: All identified BLOCKER hardcoded marketing placeholders have been neutralized. Remaining hardcoded factual strings (Tier labels, cycle years) are classified for secondary review or API linkage but no longer constitute high-risk factual misleading.

## 2. Before/After Hardening Metrics

| Metric | Pre-Hardening | Post-Hardening | Change |
| :--- | :--- | :--- | :--- |
| **Critical Blockers** | 78 | **0** | -78 (Surgical Removal) |
| **Factual Risk Surface** | 1,046 | **99** | -947 (Filtering/Hardening) |
| **Verdict** | 🚩 NOT SAFE | **⚠️ NEEDS REVIEW** | Status Upgraded |
| **Remaining Factual Strings** | TBD | **81** | Pending Linkage |

**Report Location**: `backend/reports/frontend_number_inventory/`

## 3. Remediation Tracking (Changed Files)

The following files were modified to enforce truth-grade standards:

- `frontend/src/components/NarrativeEdge.jsx`
- `frontend/src/components/home/LiveboardTicker.jsx`
- `frontend/src/components/home/IntelligenceFacts.jsx`
- `frontend/src/components/PremiumHome.jsx`
- `frontend/src/app/college/[id]/CollegeDashboardClient.jsx`
- `frontend/src/app/college/[id]/CollegeDetailClient.jsx`
- `frontend/src/app/compare/CompareClient.jsx`
- `frontend/src/components/NarrativeSentiment.jsx`
- `frontend/src/components/ROICalculator.jsx`
- `frontend/src/components/AdmissionProbability.jsx`
- `backend/tools/audit_frontend_number_inventory.js`

## 4. Neutralized Blocker Inventory

| Target Claim | Previous Behavior | New Behavior | Safety Rationale |
| :--- | :--- | :--- | :--- |
| **94% Placement** | Hardcoded fallback in NarrativeEdge | "Pending Verification" label | Prevents unproven placement velocity claims. |
| **150+ Recruiters** | Hardcoded fallback in NarrativeEdge | "Data Pending" label | Prevents synthetic recruiter density claims. |
| **4% Cutoff Drop** | Predictive alert in LiveboardTicker | Neutral advisory copy | Removes unproven market predictions. |
| **42 Institutes** | Hardcoded alert count | General audit advisory | Replaced with system-wide truth audit status. |
| **10,000+ Students** | Historical fact in IntelligenceFacts | Neutral "Ancient Heritage" copy | Avoids confusion with platform-scale counts. |
| **800,000 Fee** | Fallback in Dashboard/Calculator | `0` (User-Input or API only) | Prevents misleading tuition estimates. |
| **1,200,000 Pkg** | Fallback in Dashboard/Calculator | `0` (User-Input or API only) | Prevents misleading salary estimates. |
| **1.4M+ Points** | Hardcoded fallback in PremiumHome | "Pending Audit" label | Ensures platform stats reflect live engine data. |

## 5. Remaining Review Items (L3 Factual)

The following items are retained as low-risk factual constants requiring secondary attention:

| Category | Item(s) | File | Next Step |
| :--- | :--- | :--- | :--- |
| **REVIEW_INTERNAL_METHODOLOGY** | 70/30 Weighting | `NarrativeSentiment.jsx` | Move to a weights API. |
| **REVIEW_COPY_ONLY** | "2026 Cycle" | `CompareClient.jsx` | Update label per season. |
| **REVIEW_CONFIG_NEEDED** | Tier Labels (1, 2, 3) | `CollegesClient.jsx` | Unify Tier definitions in DB. |
| **REVIEW_API_LINKAGE_NEEDED** | Score Thresholds (70, 35) | `IntegrityTab.jsx` | Bind to anomaly engine config. |

## 6. Audit & Verification Commands

To reproduce these results, run:

```bash
# 1. Verification of blocker removal
npm run verify:number-surface
# Or: node backend/scripts/verify_no_numeric_truth_blockers.js

# 2. Layered static audit
npm run audit:number-surface
# Or: node backend/tools/audit_frontend_number_inventory.js --static-only

# 3. Full cohort analysis
node backend/tools/audit_frontend_number_inventory.js --full --cohort public --limit ALL
```

## 7. Regression Guard

A new permanent regression guard has been added:
`backend/scripts/verify_no_numeric_truth_blockers.js`

This script is designed to fail any CI pipeline if high-risk hardcoded factual strings (94%, 150+, etc.) are re-introduced into the frontend source code.

---

> [!WARNING]
> **DISCLAIMER**: This report documents **Number-Surface Hardening** (the removal of hardcoded UI placeholders). It is NOT a full CEI Data Certification. The accuracy of dynamic data retrieved from the API depends on the underlying database truth-grade and provenance status.
