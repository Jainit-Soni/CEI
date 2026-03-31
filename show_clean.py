from pathlib import Path
import re
content=Path('phase1_foundation/manual_inputs/nirf/MoE, National Institute Ranking Framework (NIRF).html').read_text(encoding='utf-8', errors='ignore')
table=re.search(r'<table[^>]+id="tbl_overall"[^>]*>(.*?)</table>', content, flags=re.S | re.I)
clean=re.sub(r'<div class="tbl_hidden".*?</div>', '', table.group(0), flags=re.S | re.I)
print(clean[:1000])
