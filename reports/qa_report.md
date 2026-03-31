# Phase 1 Foundation Data QA
Generated: 2026-03-25T05:34:54Z

## Completed Sections
- Institution master (AISHE) records from official AISHE exports remain untouched (3 source files, total 67149 institutions).
- Rankings (NIRF 2024 overall) normalized from MoE, National Institute Ranking Framework (NIRF).html and ready for downstream processing.
- Programs & intake (AICTE) normalized from aicte_course_response.json plus 211 live JSON captures (phase2a/raw/aicte_live/); ingestion processed 212 official files, 1094 raw rows, produced 1048 deduplicated program rows, and recorded 1048 provenance entries.
- Live capture duplicates audit: 46 duplicate rows and 1 row with a mismatched schema were skipped; see phase2a/aicte_dedupe_audit.md for the dedupe report.
- AICTE acquisition remains partially_acquired because coverage is still limited despite the expanded live captures.
- AICTE institute linkage data parsed from aicte_colleges-response.json (594 rows) continues to support institution-program linking.

## Blocked Sections
- None.

## Empty Sections
- None.
