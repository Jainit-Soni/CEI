# Verified Core 1.0 Source Priority Plan

## Optimization Goal
Maximize the density of `official_verified` identifiers within the 3,471 elite cohort.

## Priority Ranking

### 1. JoSAA & CSAB 2024 (Seats and Cutoffs)
- **Coverage Gain**: 100% of IITs, NITs, IIITs.
- **Determinism**: 100% (based on official JoSAA institution list).
- **User Value**: Extreme. Cutoffs are the #1 entry point for high-intent search.
- **Complexity**: Low (requires one-time ingestion of JoSAA CSVs).

### 2. NIRF 2024 (Placement Data)
- **Coverage Gain**: ~1,000+ top institutions in the cohort.
- **Determinism**: High (AISHE codes provided by NIRF).
- **User Value**: High. Verified median salaries are the "Golden Metric".
- **Complexity**: Medium (requires extracting data from NIRF placement tables).

### 3. State-Level Counseling Matrices (ACPC, CET, TNEA)
- **Coverage Gain**: Private/State elite institutions in Tier B.
- **Determinism**: High (State codes have existing bridge-building patterns).
- **User Value**: High for regional dominance.
- **Complexity**: High (requires state-by-state ingestion).

---

## Action Recommendation
Immediately pivot to **JoSAA 2024 Ingestion** once the Verified Core 1.0 architecture is finalized.
