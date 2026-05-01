
# CEI Frontend Provenance & Freshness Audit

**Audit Date**: 2026-05-01
**Denominator**: 197 Colleges (Public Cohort)
**Verdict**: ⚠️ PROVENANCE_SURFACE_NEEDS_REVIEW

## 1. Summary Metrics

| Section | Rendered | Full Prov | Partial Prov | Total Prov % | Visible Fresh | Fresh % | Blockers | Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| seats | 109 | 0 | 109 | 100.00% | 109 | 100.00% | 0 | REVIEW |
| cutoffs | 87 | 87 | 0 | 100.00% | 87 | 100.00% | 0 | SAFE |
| fees | 16 | 0 | 16 | 100.00% | 16 | 100.00% | 0 | REVIEW |
| placements | 15 | 0 | 0 | 0.00% | 0 | 0.00% | 0 | REVIEW |
| rankings | 0 | 0 | 0 | 0.00% | 0 | 0.00% | 0 | SAFE |
| ceiScore | 190 | 0 | 0 | 0.00% | 0 | 0.00% | 190 | BLOCKER |

> [!NOTE]
> **Rendered Count Definition**: Refers to unique college-section pairs (active truth surfaces) within the 197-node cohort where admission-critical truth data (items) is successfully surfaced to the frontend.

## 2. Launch Risk Assessment
- **Blockers**: 190 (Admission truth without source)
- **Reviews**: 140 (API has metadata but UI hides it OR source is string-only)

## 3. Top Provenance Gaps (API vs UI)


## 4. Known Debts
- CEI Score provenance is currently internal-only and not explicitly rendered as a "source".
- Ranking provenance is often embedded in the name/title but lacks extraction date metadata.
- "Stale" status detection is currently static; requires dynamic comparison with source registries.

## 5. Final Verdict Reasoning
Multiple admission-critical sections (190 cases) are rendering numeric truth without an associated source. This violates CEI Truth-Grade requirements.
    