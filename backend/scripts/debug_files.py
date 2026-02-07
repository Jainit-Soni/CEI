
import os
from pathlib import Path

models_dir = r"e:\CMAT-PROBLEM\backend\models"
models_path = Path(models_dir)

print(f"Checking directory: {models_path}")
if not models_path.exists():
    print("Does not exist!")
else:
    files = list(models_path.glob("*_Colleges.json"))
    print(f"Found {len(files)} files.")
    for f in sorted(files):
        print(f.name)
