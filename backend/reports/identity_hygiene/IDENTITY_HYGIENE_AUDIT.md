
# CEI Identity Hygiene Audit Report

**Date**: 2026-05-01
**Cohort Size**: 197
**Cohort Definition**: Public engineering cohort including AICTE/catalog records (80 AICTE IDs detected)
**Verdict**: ✅ IDENTITY_HYGIENE_STABLE

> [!IMPORTANT]
> **PUBLIC_COHORT_DEFINITION_REVIEW**: The cohort contains non-elite AICTE identifiers. Verify if this matches release intent.

## 1. Summary Stats
- **Total Audited**: 197
- **SAFE**: 196
- **REVIEW**: 1
- **BLOCKER**: 0

> [!NOTE]
> **Summary Clarification**: 196 records have no detected identity conflict under current resolver rules. Missing truth records are not counted as identity mismatches.

## 2. Identified Risks
- **CORE-CORE Prefix Cases**: 1
  - Deterministic Rewrite-Ready: 0
  - Manual Canonical Target Required: 1
- **Identity Mismatches**: 0

## 3. Top 10 Risky Mismatches
None found

## 4. Double Prefix Analysis (CORE-CORE)
Found 1 instances of double-prefixed IDs. 
- **PRADESH Case**: CORE-CORE-IIIT-PRADESH remains unresolved (Manual Target Required).

## 5. Audit Integrity
- Verified across Catalog (Institutions), Seat Matrix, and Engineering Cutoffs collections.
- Regression guard references preserved.
