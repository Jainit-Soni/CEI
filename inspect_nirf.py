from pathlib import Path
import re
content=Path('phase1_foundation/manual_inputs/nirf/MoE, National Institute Ranking Framework (NIRF).html').read_text(encoding='utf-8', errors='ignore')
pattern=r'<table id="tbl_overall".*?</table>'
match=re.search(pattern, content, flags=re.S)
print('match', bool(match))
if match:
    print(match.group(0)[:2000])
