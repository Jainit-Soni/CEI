# Manual AICTE Inputs
1. Download the official AICTE approved programs/intake export. The pipeline now accepts:
   - Official CSV downloads (preferred)
   - Official Excel workbooks (.xls or .xlsx)
   - Saved official HTML pages that contain the approved programs/intake tables
2. Save the file exactly as released by AICTE and drop it into `phase2a/manual_inputs/aicte/`. Keep the original export to preserve provenance; do not modify or re-format values.
3. Re-run `phase1_foundation/run_phase1_pipeline.py`. The pipeline will normalize programs, approved intake, and accreditation metadata into `normalized/programs.ndjson`, `normalized/accreditations.ndjson`, and `evidence/program_provenance.ndjson`.
