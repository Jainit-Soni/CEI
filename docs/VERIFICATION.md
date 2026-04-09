# CEI Truth Layer Verification Guide

This document defines the standard verification flow for ensuring institutional data integrity, focusing on NIRF 2024 and subsequent truth layers.

## 1. Automated API Contract Tests
The primary gate for data regression is the backend contract suite.

### Running NIRF 2024 Validation
Ensure the backend server is running (`npm run dev` in `/backend`).
```bash
cd backend
npm run verify
```
**Pass Criteria:**
- Samples `U-0456`, `U-0517`, `U-0100` must return `source: 'NIRF'`, `year: '2024'`, and a defined `category`.
- `U-0001` (Negative Case) must return `sectionStatus: 'official_data_unavailable'`.

---

## 2. Visual Smoke Checks (Manual)
Every truth-ingestion phase must be followed by a visual audit of the frontend.

### A. Institutional Rankings (Overview Tab)
- **Check Location:** `localhost:3030/college/{id}` -> Overview -> Institutional Standing.
- **Verification Nodes:**
    - Table Headers: Authority, Category, Rank, Year.
    - Category Display: Must show "Overall", "Engineering", etc. (No "N/A" or empty blocks).
    - Styling: Ranks should be `text-accent font-bold`.

### B. Placement Truth (Placements Tab)
- **Check Location:** `localhost:3030/college/{id}` -> Placements.
- **Verification Nodes:**
    - Metric Title: "Median Salary (NIRF)".
    - Value Format: "₹XX.XX LPA".
    - Batch: "2023-24" (or current cycle).
    - Source: "Official Source: NIRF 2024" badge visible.

### C. Empty State Behavior
- **Target:** A college without NIRF data (e.g., `U-0001`).
- **Pass Criteria:**
    - Rankings Table: Show "Official Ranking Data Pending Audit".
    - Placements: Show "Official placement data unavailable".
    - **No broken cards or console errors.**

---

## 3. Failure Protocol
If a verification check fails:
1.  **Check Cache:** Run `GET /api/flush-cache` to ensure memory buffer is fresh.
2.  **Verify SSoT:** Check MongoDB for the institution ID. If missing, re-run ingestion.
3.  **Inspect Schema:** Check for mismatched fields (e.g., `rank` vs `rankValue`).
