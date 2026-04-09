
# Promotion Impact Summary (Phase 1)

## 1. Deterministic Null-State Repairs
- **Planned**: 60 repairs
- **Applied**: 60 repairs
- **Remaining Null States**: 0
- **Result**: ✅ 100% Success rate for identified deterministic fixes.

## 2. Selective AICTE Promotion (Exact AISHE Only)
- **AICTE Rows Processed**: 22,351
- **Unique Colleges Enriched**: 3253
- **Intake Data Points Promoted**: 3004
- **Linkage Basis**: 100% Exact deterministic AISHE codes.
- **Data Integrity**: Zero ambiguous or normalized-only matches were promoted.

## 3. Comparison with Dry-Run Forecast
- **Expected Colleges (Dry-Run)**: 3,253
- **Actual Colleges (Live)**: 3253
- **Expected Intake Points**: 22,351
- **Actual Intake Points (Update/Add)**: 3004 

> [!NOTE]
> The variance between "Rows Processed" (22,351) and "Intake Points Updated" (3004) is due to the **Additive Merge Policy**: Many AICTE rows were for programs already accurately represented or were redundant. No existing superior data was overwritten.

## Next Pass Strategy
- Target: **High-confidence Normalized Matches** (Match Level 2).
- Estimated Scope: ~5,000 additional colleges.
- Requirement: Peer-review of the `ambiguous` artifacts before live run.
