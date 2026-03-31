from pathlib import Path
import re
content=Path('phase1_foundation/manual_inputs/nirf/MoE, National Institute Ranking Framework (NIRF).html').read_text(encoding='utf-8', errors='ignore')
table=re.search(r'<table[^>]+id="tbl_overall"[^>]*>(.*?)</table>', content, flags=re.S | re.I)
if not table:
    raise SystemExit('no table')
tbody=re.search(r'<tbody[^>]*>(.*?)</tbody>', table.group(0), flags=re.S | re.I)
if not tbody:
    raise SystemExit('no tbody')
print(tbody.group(1)[:1000])
