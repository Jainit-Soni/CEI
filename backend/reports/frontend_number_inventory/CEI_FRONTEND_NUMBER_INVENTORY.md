# CEI Frontend Number Inventory (Truth Audit)

**Audit Date**: 2026-05-01
**Audit Methodology**: 4-Layer Static Analysis (REGEX_RAW_NUM Pass)

## 1. Count Reconciliation Table

| Metric | Count | Explanation |
| :--- | :--- | :--- |
| **raw_numeric_candidates_count** | 30443 | All numeric strings/literals (L1: Includes CSS/Config/FALSE POSITIVES) |
| **filtered_frontend_number_candidates_count** | 2741 | Visible numbers (L2: Excludes CSS/Layout/Props/Ports) |
| **factual_user_visible_numbers_count** | 99 | Real CEI Risk Surface (L3: Claims about colleges/admissions) |
| **confirmed_rendered_numbers_count** | 0 | Verified via Runtime/Browser Check (L4) |
| **hardcoded_total_raw** | 24489 | Every hardcoded number literal in codebase |
| **hardcoded_factual_claim_count** | 81 | Factual claims found hardcoded in JS/JSX |
| **hardcoded_unsafe_count** | 0 | Factual claims flagged as marketing/placeholders |
| **unsafe_or_unproven_count** | 0 | Total surface area requiring provenance linkage |

## 2. Risk Distribution (L3 Factual Only)

- **BLOCKER**: 0
- **REVIEW**: 81
- **SAFE**: 2137

## 3. Top 10 BLOCKER Numbers (High Risk)



## 4. Top 10 REVIEW Numbers

- **70** in `frontend\src\app\admin\tabs\IntegrityTab.jsx`:  function getSeverity(score) { if (score >= 70) return 'high'; if (score >= 35) return 'med
- **35** in `frontend\src\app\admin\tabs\IntegrityTab.jsx`: if (score >= 70) return 'high'; if (score >= 35) return 'medium'; return 'low'; } functi
- **2** in `frontend\src\app\college\[id]\CollegeDashboardClient.jsx`: ege.ceiScore)) ? Number(college.ceiScore).toFixed(2) : 'TBA'} </div> 
- **0** in `frontend\src\app\college\[id]\page.js`: Rating "aggregateRating": college.ceiScore > 0 ? { "@type": "AggregateRating", "ra
- **1** in `frontend\src\app\colleges\CollegesClient.jsx`: college.rankingTier?.toLowerCase().includes("tier 1") ? 3 : college.rankingTier?.toLowerCase
- **3** in `frontend\src\app\colleges\CollegesClient.jsx`: e.rankingTier?.toLowerCase().includes("tier 1") ? 3 : college.rankingTier?.toLowerCase().inc
- **2** in `frontend\src\app\colleges\CollegesClient.jsx`: college.rankingTier?.toLowerCase().includes("tier 2") ? 2 : college.rankingTier?.toLower
- **2** in `frontend\src\app\colleges\CollegesClient.jsx`: e.rankingTier?.toLowerCase().includes("tier 2") ? 2 : college.rankingTier?.toLowerCase()
- **1,** in `frontend\src\app\colleges\CollegesClient.jsx`:  setPagination({ page: 1, totalPages: 1, 
- **1** in `frontend\src\app\colleges\CollegesClient.jsx`:  isCore: "All" }); setPage(1); setError(null); setSuggestion

## 5. Audit Validation (Targeted Flags)

| Value | Status | Found In |
| :--- | :--- | :--- |
| **94%** | MISSING | N/A |
| **150+** | MISSING | N/A |
| **4%** | MISSING | N/A |
| **42** | MISSING | N/A |
| **10,000+** | MISSING | N/A |
| **2026** | MISSING | N/A |

## 6. Final Verdict
## ⚠️ NUMBER_SURFACE_NEEDS_REVIEW

**Reasoning**: Multiple year/aggregate labels found without dynamic provenance.

## 7. Count Reconciliation Explanation
The raw scan (30443) includes every number literal in the codebase, including CSS units (px, rem), color hexes, and internal config values. 
The filtered set (2741) isolates numbers that are likely rendered as content. 
The factual set (99) focuses exclusively on admission-critical claims.
