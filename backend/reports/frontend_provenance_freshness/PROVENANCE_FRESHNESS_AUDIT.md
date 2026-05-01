
# CEI Frontend Provenance & Freshness Audit

**Audit Date**: 2026-05-01
**Denominator**: 197 Colleges (Public Cohort)
**Verdict**: ✅ PROVENANCE_SURFACE_SAFE_FOR_LIMITED_PUBLIC_COHORT

## 1. Summary Metrics

| Section | Rendered | Full Prov | Partial Prov | Total Prov % | Visible Fresh | Fresh % | Blockers | Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| seats | 0 | 0 | 0 | 0.00% | 0 | 0.00% | 0 | SAFE |
| cutoffs | 0 | 0 | 0 | 0.00% | 0 | 0.00% | 0 | SAFE |
| fees | 0 | 0 | 0 | 0.00% | 0 | 0.00% | 0 | SAFE |
| placements | 0 | 0 | 0 | 0.00% | 0 | 0.00% | 0 | SAFE |
| rankings | 0 | 0 | 0 | 0.00% | 0 | 0.00% | 0 | SAFE |
| ceiScore | 0 | 0 | 0 | 0.00% | 0 | 0.00% | 0 | SAFE |

## 2. Launch Risk Assessment
- **Blockers**: 0 (Admission truth without source)
- **Reviews**: 0 (API has metadata but UI hides it OR source is string-only)

## 3. Top Provenance Gaps (API vs UI)


## 4. Known Debts
- CEI Score provenance is currently internal-only and not explicitly rendered as a "source".
- Ranking provenance is often embedded in the name/title but lacks extraction date metadata.
- "Stale" status detection is currently static; requires dynamic comparison with source registries.

## 5. Final Verdict Reasoning
All rendered sections for the public cohort include visible provenance metadata.
    