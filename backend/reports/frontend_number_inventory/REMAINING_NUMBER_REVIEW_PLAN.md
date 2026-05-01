# CEI Remaining Number Review Plan

This document classifies the 81 lower-risk factual constants remaining on the CEI frontend after the initial truth-hardening pass.

## 1. Classification Methodology

| Category | Action | Rationale |
| :--- | :--- | :--- |
| **KEEP_AS_SAFE_COPY** | None | Pure UI labels or harmless context (e.g. "Last 24 Hours"). |
| **MOVE_TO_CONFIG** | Refactor to `ceiNumberConfig.js` | Constants used in multiple places or representing system logic. |
| **MOVE_TO_API** | Deferred | Items that require a new backend endpoint for dynamic truth. |
| **LABEL_AS_INTERNAL** | Add UI label | Clarify that the number is an internal CEI methodology result. |
| **NEEDS_DECISION** | Manual Review | Ambiguous items requiring product owner input. |

## 2. Priority Review Items

### A. CEI Scoring & Methodology
- **Numbers**: `70`, `35` (Severity Thresholds)
- **File**: `IntegrityTab.jsx`
- **Recommended Action**: **MOVE_TO_CONFIG** (`INTEGRITY_SCORE_THRESHOLDS`)
- **Risk**: Low (Internal logic)

- **Numbers**: `70/30` (Weighting)
- **File**: `NarrativeSentiment.jsx`
- **Recommended Action**: **LABEL_AS_INTERNAL** ("CEI Internal Methodology")
- **Risk**: Low (Transparency)

### B. Tier & Ranking Labels
- **Numbers**: `1`, `2`, `3` (Tier IDs)
- **File**: `CollegesClient.jsx`
- **Recommended Action**: **MOVE_TO_CONFIG** (`TIER_DEFINITIONS`)
- **Risk**: Medium (Factual claim about quality)

### C. Active Cycle & Years
- **Numbers**: `2026`, `2024`
- **Files**: `CompareClient.jsx`, `CollegeDetailClient.jsx`
- **Recommended Action**: **MOVE_TO_CONFIG** (`ACTIVE_SCORING_CYCLE`)
- **Risk**: Low (Freshness label)

### D. Platform Scale Claims
- **Number**: `12,000+`
- **File**: `admission-calculator/page.js`
- **Recommended Action**: **LABEL_AS_INTERNAL** or **MOVE_TO_API**
- **Risk**: Medium (Marketing headcount)

## 3. Inventory Classification (Sample of 81)

| Item | Context | Recommended Action | Risk |
| :--- | :--- | :--- | :--- |
| **70** | Anomaly Severity Threshold | MOVE_TO_CONFIG | Low |
| **35** | Anomaly Severity Threshold | MOVE_TO_CONFIG | Low |
| **2026** | Scoring Cycle | MOVE_TO_CONFIG | Low |
| **Tier 1** | Ranking Tier Search | MOVE_TO_CONFIG | Medium |
| **12,000+** | College Count Claim | MOVE_TO_API | Medium |
| **0.2s** | UI Transition | KEEP_AS_SAFE_COPY | SAFE |
| **30s** | Auto-refresh | KEEP_AS_SAFE_COPY | SAFE |

## 4. Execution Status (2026-05-01)
1. ✅ **MOVED TO CONFIG**: Scoring cycle (2026), truth table year (2024), and severity thresholds (70/35) now reside in `ceiNumberConfig.js`.
2. ✅ **LABELED AS INTERNAL**: Removed "70/30" hardcoding from Narrative description; labeled as algorithmic synthesis.
3. ✅ **NEUTRALIZED**: Removed "12,000+" platform scale claim from admission calculator.
4. ⏳ **DEFERRED**: Tier ID mapping logic in `CollegesClient.jsx` requires deeper refactoring.

---
**Verdict**: `NUMBER_SURFACE_NEEDS_REVIEW`
**Remaining Review Count**: 79
**Next Phase**: Full API Linkage for Tier and Score stats.
