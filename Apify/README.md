# CEI Apify Pipeline

## Structure
- collectors/ -> raw collection scripts
- parsers/ -> normalization scripts
- cei_raw/ -> raw downloaded and extracted source data
- cei_normalized/ -> CEI-ready normalized data
- logs/ -> collector/parser logs

## First steps
1. Put your Apify token in `.env`
2. Implement `collectors/collect_nta_notice_archive.py`
3. Run collector
4. Run `parsers/normalize_nta_notices.py`
