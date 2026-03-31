# Phase 1 Foundation Data Coverage
Generated: 2026-03-25T05:34:54Z

## Institution Master (AISHE)
- Total unique institutions normalized: 67149
- Colleges (aishe_colleges.csv): 51288 records, 0 duplicates ignored
- Standalone institutions (aishe_standalone.csv): 14553 records, 0 duplicates ignored
- Universities (aishe_university.csv): 1308 records, 0 duplicates ignored

## Rankings
- Rankings normalized from manual official file(s): MoE, National Institute Ranking Framework (NIRF).html. Total records: 100.

## Programs & Intake (AICTE)
- Programs normalized from official AICTE sources: aicte_course_response.json plus 211 live JSON captures (phase2a/raw/aicte_live/). Total normalized records: 1048.
- AICTE acquisition status: partially_acquired.
- Live capture coverage: 211 JSON course responses (plus the manual export) produced 1094 raw rows, yielding 1048 deduplicated program rows with 46 duplicates and 1 skipped row; see phase2a/aicte_dedupe_audit.md for the detail on duplicate groups.
- AICTE institute linkage data parsed from manual official file(s): aicte_colleges-response.json. Total rows: 594.
- Normalized accreditations: not available (AICTE course responses do not surface separate accreditation metadata yet).
