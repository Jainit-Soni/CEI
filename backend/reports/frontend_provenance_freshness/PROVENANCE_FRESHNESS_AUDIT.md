
# CEI Frontend Provenance & Freshness Audit

**Audit Date**: 2026-05-01
**Denominator**: 197 Colleges (Public Cohort)
**Verdict**: ✅ PROVENANCE_SURFACE_SAFE_FOR_LIMITED_PUBLIC_COHORT_WITH_REVIEWS

## 1. Summary Metrics

| Section | Rendered | Full Prov | Partial Prov | API Only | Missing | Blockers | Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| seats | 110 | 0 | 110 | 0 | 0 | 0 | REVIEW |
| cutoffs | 88 | 88 | 0 | 0 | 0 | 0 | SAFE |
| fees | 16 | 0 | 16 | 0 | 0 | 0 | REVIEW |
| placements | 15 | 0 | 0 | 15 | 0 | 0 | REVIEW |
| rankings | 0 | 0 | 0 | 0 | 0 | 0 | SAFE |
| ceiScore | 191 | 0 | 0 | 0 | 0 | 0 | REVIEW |

> [!NOTE]
> **Rendered Count Definition**: Refers to unique college-section truth surfaces found within the 197-node cohort where admission-critical truth data (items) is successfully surfaced to the frontend.

## 2. Launch Risk Assessment
- **Blockers**: 0 (Admission truth without source)
- **Reviews**: 332 (Visible partial, API-only, or Internal Methodology)
  - Partial Visible: 126
  - API-only Not Rendered: 15
  - Internal Methodology (CEI Score): 191

## 3. Provenance Certification Status
- **Admission-Critical Sections**: 0 blocker-level missing provenance for official rendered sections (Seats, Cutoffs, Fees, Placements).
- **Truth Transparency**: Visible full or partial provenance available for all rendered source-backed sections.
- **CEI Score**: Classified as Internal Methodology (Visible); methodology label present in NarrativeIntel component.

## 4. Known Debts
- Ranking provenance is often embedded in the name/title but lacks extraction date metadata.
- "Stale" status detection is currently static; requires dynamic comparison with source registries.

## 5. Final Verdict Reasoning
Surface is SAFE for the limited public cohort because all rendered admission-critical truth points have at least partial visible provenance or are correctly labeled as internal methodology (CEI Score).
    