from pathlib import Path
content=Path('phase1_foundation/manual_inputs/nirf/MoE, National Institute Ranking Framework (NIRF).html').read_text(encoding='utf-8', errors='ignore')
idx=content.find('tbl_hidden')
print(content[idx-50:idx+100])
