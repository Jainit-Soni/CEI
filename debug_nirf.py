from pathlib import Path
import re
content=Path('phase1_foundation/manual_inputs/nirf/MoE, National Institute Ranking Framework (NIRF).html').read_text(encoding='utf-8', errors='ignore')
table=re.search(r'<table[^>]+id="tbl_overall"[^>]*>(.*?)</table>', content, flags=re.S|re.I)
print('table', bool(table))
table_html=table.group(0) if table else ''
cleaned=re.sub(r'<div class="tbl_hidden".*?</div>', '', table_html, flags=re.S|re.I)
tbody=re.search(r'<tbody[^>]*>(.*?)</tbody>', cleaned, flags=re.S|re.I)
print('tbody', bool(tbody))
rows=re.findall(r'<tr[^>]*>(.*?)</tr>', tbody.group(1) if tbody else '', flags=re.S|re.I)
print('rows', len(rows))
for i,row in enumerate(rows[:5],1):
    cells=re.findall(r'<td[^>]*>(.*?)</td>', row, flags=re.S|re.I)
    print(i,len(cells))
    for j,cell in enumerate(cells):
        print('cell', j, cell[:60])
