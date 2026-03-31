from pathlib import Path
lines=Path('phase1_foundation/run_phase1_pipeline.py').read_text(encoding='utf-8').splitlines()
for i in range(360, 460):
    print(f"{i+1}: {lines[i]}")
