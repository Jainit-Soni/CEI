from pathlib import Path
text = Path('phase2a/aicte_live_collect.py').read_text()
start = text.index('        page = await context.new_page()')
end = text.index('        session = context.request', start)
print(repr(text[start:end]))
