from pathlib import Path
path = Path('phase1_foundation/run_phase1_pipeline.py')
text = path.read_text(encoding='utf-8')
needle = r"r'<div class=\"tbl_hidden\".*?</div>'"
repl = r"r'<div[^>]*class=\"tbl_hidden\"[^>]*>.*?</div>'"
if needle not in text:
    raise SystemExit('needle missing')
text = text.replace(needle, repl, 1)
path.write_text(text, encoding='utf-8')
