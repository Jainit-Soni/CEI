# Manual NIRF Inputs
1. Download the official 2024 overall ranking page or PDF directly from https://www.nirfindia.org/Rankings/2024/OverallRanking150.html or the equivalent official release on the NIRF portal.
2. Save the HTML, CSV, or PDF exactly as provided by the Ministry of Education. Example file names: `nirf-2024-overall.html`, `nirf-2024-overall.csv`, `nirf-2024-overall.pdf`.
3. Place the downloaded file(s) into this folder (`phase1_foundation/manual_inputs/nirf/`). Do not edit or copy/paste data; keep the original export to preserve provenance.
4. Re-run `phase1_foundation/run_phase1_pipeline.py`. The pipeline will parse the manual drop and normalize the NIRF ranking data into `normalized/rankings.ndjson`. If the official release includes multiple formats, feel free to drop each version here for redundancy.
