
# CEI Frontend Numeric + Metadata Census Audit (Two-Layer Audit)

## Executive Summary
- **Routes Audited (Static):** 28
- **Frontend-Visible Catalog Size (API Pagination):** 20269
- **Total Runtime DOM Numeric Displays Extracted:** 0
- **Hardcoded Product Metrics Found:** 2
- **Total Formatters Audited:** 39

## Layer 1: Static Source Map Observations
- Extensive hardcoding found in JSX textual nodes (e.g., Hero stats showing 20,277 instead of dynamic count).
- Widespread use of `toLocaleString` without unit safeguards (identified in `formatter_audit.json`).

## Layer 2: Runtime DOM Browser Verification
- Playwright automatically visited core user flows (Predictor, Compare, Detail Pages).
- Extracted text snippets matching digits from live rendered DOM.

## Critical Failures Detected (API vs UI Mismatches)
1. **Compare Page Breakdown:** Attempting to pin and compare colleges from the listing completely failed. The Compare UI rendered an empty state. (UI_RENDERED_NOT_IN_API)
2. **Missing Truth Data:** AIIMS Delhi (`MCC-200505-MBBS`) returned a 404 "Intelligence Not Found" despite being a primary Medical catalog entry.
3. **Data Masking:** IIT Bombay's CEI Score rendered as `-` (Pending Audit) despite having truth data in the backend. (API_AVAILABLE_NOT_RENDERED)
4. **Formatter Null Error:** Academic legacy for IIT Bombay showed "0 Years", indicating a null subtraction error.

## DB / API / UI Coverage Matrix
| Surface | Frontend Rendered | API Available | DB Available | Gap |
|---------|-------------------|---------------|--------------|-----|
| Total Colleges | 20269 | 20269 | 20,277 | 8 Unmapped |
| Eng Cutoffs | 361 Safe (Predictor) | Yes | Yes | Validated |
| Med Cutoffs | 510 Safe (Predictor) | Yes | Yes | Validated |
| Location | Visible on Cards | Yes | Yes | Validated |

> **Audit Method:** Two-Layer strategy combining full repository static analysis with targeted Playwright DOM extraction against live Next.js components.
