from pathlib import Path
path=Path('phase1_foundation/run_phase1_pipeline.py')
text=path.read_text(encoding='utf-8')
old='re.sub(\n                r\'<div class="tbl_hidden".*?</div>',\n                "",\n                table_html,\n                flags=re.S | re.I,\n            )'
new='re.sub(\n                r\'<div[^>]*class="tbl_hidden"[^>]*>.*?</div>',\n                "",\n                table_html,\n                flags=re.S | re.I,\n            )'
if old not in text:
    raise SystemExit('pattern block not found')
text=text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
