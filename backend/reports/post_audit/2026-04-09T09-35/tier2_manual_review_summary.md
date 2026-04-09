# Tier 2 Manual Review Summary (Strict Official Evidence)

## Pool Overview
Out of the 28 remaining AICTE rows that were not promoted in Phase 1, **0** qualified as "Verified Candidates" under the strict official-evidence rules.

## Primary Impediment: Data Defect
The 28 unresolved rows (representing programs under AISHE codes `C-51564` and `C-10214`) share a critical structural defect:
- **Missing Institutional Name**: The rows contain `programName` and `collegeId` but no `institutionName` or `name` field at the institution level.
- **Ambiguous Parent**: Matching by the program name alone (e.g., "Chemical and Biotechnology") against the registry is disallowed as it does not target a unique institution.

## Manual Review Pack (Top Candidates)
| AICTE Raw ID | Program Name | State | CEI Match Candidate | Conflict/Missing Evidence |
| :--- | :--- | :--- | :--- | :--- |
| C-51564 | Chemical and Biotechnology | Maharashtra | NULL | Missing Institutional Name field |
| C-10214 | BIOMEDICAL ENGINEERING | Tamil Nadu | NULL | Missing Institutional Name field |

## Required Evidence for Upgrade
To move these rows from **Unresolved** to **Verified**, the source dataset must provide:
1.  The clear, official name of the institution linked to AISHE `C-51564` and `C-10214`.
2.  Confirmation that these AISHE codes exist in the official master registry (they are currently missing from the CEI database).

## Conclusion
No Tier 2 live promotion is justified at this time. The data quality of the remaining 28 rows is insufficient for automated or even safe manual linking without external registry expansion.
