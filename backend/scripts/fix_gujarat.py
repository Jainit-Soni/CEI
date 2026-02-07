
import json
import os
from pathlib import Path

PLACEMENT_DATA = {
    "iim-ahm": {
        "averagePackage": "₹36.41 LPA",
        "medianPackage": "₹35.0 LPA",
        "highestPackage": "₹1.50 CPA"
    }
}

file_path = r"e:\CMAT-PROBLEM\backend\models\Gujarat_Colleges.json"

print(f"Reading {file_path}...")
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        colleges = json.load(f)
    print(f"Loaded {len(colleges)} colleges.")
    
    found = False
    for college in colleges:
        college_id = college.get('id')
        if college_id == "iim-ahm":
            print(f"Found 'iim-ahm'!")
            print(f"Current matches PLACEMENT_DATA key? {'iim-ahm' in PLACEMENT_DATA}")
            
            if 'iim-ahm' in PLACEMENT_DATA:
                college['placements'] = PLACEMENT_DATA['iim-ahm']
                print("Injected placement data.")
                found = True
                
    if found:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(colleges, f, indent=2, ensure_ascii=False)
        print("Detailed verification: File written successfully.")
    else:
        print("Did not find 'iim-ahm' in file.")

except Exception as e:
    print(f"Error: {e}")
