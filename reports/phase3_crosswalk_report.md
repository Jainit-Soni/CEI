# Phase 3 Crosswalk Report
**Generated:** 2026-04-19  
**Denominator:** 13,096 catalog-visible AICTE institutions

---

## Source Policy Applied

### Included (Identity-Rich — Used to Build Crosswalk)

| File | Records Loaded | Role |
|------|---------------|------|
| `aishe_colleges.csv` | ~51,288 | Primary AISHE C-code → name/state/city |
| `aishe_university.csv` | ~1,000 | University-level U-codes |
| `aishe_standalone.csv` | ~700 | Standalone institution codes |
| `websites_truth.ndjson` | ~45,800 | Domain corroboration per C-code |
| `maharashtra_fra_2024.ndjson` | 146 | EN-code → name (Maharashtra only) |
| `maharashtra_fra_2024_bulk.ndjson` | — | EN-code supplemental |

### Excluded (Outcome-Only — Attach AFTER crosswalk exists)

| File | Reason Excluded |
|------|----------------|
| `placements_truth.ndjson` | Name-only rows, no identity fields |
| `fees_truth.ndjson` | Name-only elite rows |
| `core_placements_v2.ndjson` | Name-only, IIT/NIT not in AICTE 13k catalog |
| `core_fees_v2.ndjson` | Name-only, IIT/NIT not in AICTE 13k catalog |
| `cutoffs_truth.ndjson` | Program/seat rows using S-prefix (not institution-level) |
| `courses_truth.ndjson` | Program rows using S-prefix |
| `aicte_iceberg_truth.ndjson` | Program rows using S-prefix |
| `rankings_truth.ndjson` | Metric-only rows |
| Sparse NDJSON rows missing domain/code/city-state | Excluded per Phase 3 rule |

---

## Mapping Results by Method

| Method | Count | Safety Level |
|--------|-------|-------------|
| `exact_name_state` | 2,242 | Deterministic — unique name + state match |
| `ambiguous_name_city_state_corroborated` | 62 | Deterministic — both city AND state required |
| `exact_name_maharashtra_unique` (EN-codes) | 23 | Deterministic — unique MH name match |
| `exact_domain` | 0 | Not available — AICTE records have no domain field |
| **Total safely mapped** | **2,327** | |

| Outcome | Count |
|---------|-------|
| Ambiguous (manual review queue) | 454 |
| EN-codes too abbreviated for exact match | 123 |
| Unresolved (no AICTE catalog entry or no corroborator) | ~94,000+ |

> [!NOTE]
> The large "unresolved" pool reflects AISHE's 51k total institutions vs AICTE's 13k approved catalog. The majority of unresolved rows are AISHE institutions that are not AICTE-registered and correctly belong outside the catalog-visible cohort.

---

## Before / After Truth Attachment (13k AICTE Catalog)

| Metric | Before Phase 3 | After Phase 3 | Delta |
|--------|---------------|---------------|-------|
| Fees attached | 0 | **555** | +555 |
| Placements attached | 0 | **9** | +9 |
| Rankings/NIRF attached | 0 | **11** | +11 |
| Courses | 0 | 0 | — |
| Resolver: Deterministic resolved | 0 | **19,822** | +19,822 |
| Ambiguous dropped (safe) | — | 261 | — |

---

## Key Structural Findings

### Why Fees = 555 (not higher)
- **2,781 total fee rows** exist with IDs across all truth files
- **558 resolve** via crosswalk (C-codes matched by AICTE name+geography)
- **2,223 unresolved** because:
  - `C-XXXX` codes that belong to AISHE-only schools (not in 13k AICTE cohort)
  - `EN-XXXX` codes with abbreviated names that can't be exactly matched
  - `CORE-XXXX` IIT/NIT/IIM codes — these institutions are not AICTE-registered and are outside the catalog-visible denominator

### Why Placements = 9
- Only 103 total placement rows have explicit IDs (the rest are name-only elite rows)
- 9 of those C-codes resolved via crosswalk
- Name-only rows (IIT Bombay, IIT Delhi, IIT Madras) were correctly excluded — IITs are not in the 13k AICTE catalog

### Why CORE entities stay at 0 (expected, correct)
IITs, IIMs, AIIMS are governed by Parliament Acts, not AICTE-regulated. They are correctly excluded from the 13k AICTE denominator. Their truth data attaches only via the CORE entity spawning path in `applyTruthEnrichment` — which is by design separate from the AICTE Catalog cohort.

---

## Generated Artifacts

| File | Purpose |
|------|---------|
| `backend/data/mappings/institution_crosswalk.ndjson` | 2,327 deterministic AISHE → AICTE mappings |
| `backend/data/mappings/en_code_crosswalk.ndjson` | 23 EN-code → AICTE (Maharashtra) mappings |
| `backend/data/mappings/manual_review_queue.json` | 454 ambiguous AISHE records needing curator |
| `backend/data/mappings/en_code_review_queue.json` | 123 EN-code abbreviated names for manual curation |
| `backend/data/mappings/unresolved_log.json` | Sample of 500 unresolved records with reasons |
| `backend/data/truth/identity_collision_report.json` | Runtime resolver collision log |

---

## Next Steps to Increase Coverage (Deterministic Only)

1. **Domain enrichment pass**: Fetch official domains from AICTE portal for the 13k cohort. This would unlock `exact_domain` matching and resolve many currently-ambiguous names.
2. **Manual curation sprint**: The 454-item `manual_review_queue.json` contains the highest-value ambiguous institutions. Each requires a human to select the correct AICTE candidate.
3. **EN-code full curation**: The 123-item EN-code review queue with abbreviated Maharashtra names needs a human-curated DTE↔AICTE code mapping.
4. **S-prefix program joins**: `courses_truth`/`cutoffs_truth` use program-level S-keys — these attach per-program and need a separate routing layer.
