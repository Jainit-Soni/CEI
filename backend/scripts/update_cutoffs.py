
import json
import os
from pathlib import Path

# Verified Cutoff Data (2024/2023)
CUTOFF_DATA = {
    # IITs (JEE Advanced 2024 - General - Gender Neutral - Round 5/6 Closing Ranks)
    "iit-bombay": [
        {"examId": "jee-advanced", "year": "2024", "cutoff": "CSE: 68 | Electrical: 464 | Mech: 1685", "source": "JoSAA 2024"}
    ],
    "iit-delhi": [
        {"examId": "jee-advanced", "year": "2024", "cutoff": "CSE: 116 | MnC: 303 | Electrical: 586", "source": "JoSAA 2024"}
    ],
    "iit-madras": [
        {"examId": "jee-advanced", "year": "2024", "cutoff": "CSE: 159 | Electrical: 1100 | Mech: 2500", "source": "JoSAA 2024"}
    ],
    "iit-kanpur": [
        {"examId": "jee-advanced", "year": "2024", "cutoff": "CSE: 248 | Electrical: 1250 | Mech: 2900", "source": "JoSAA 2024"}
    ],
    "iit-kharagpur": [
        {"examId": "jee-advanced", "year": "2024", "cutoff": "CSE: 414 | ECE: 1132 | Mech: 3300", "source": "JoSAA 2024"}
    ],
    "iit-roorkee": [
        {"examId": "jee-advanced", "year": "2024", "cutoff": "CSE: 481 | ECE: 1420 | Data Science: 715", "source": "JoSAA 2024"}
    ],
    "iit-guwahati": [
        {"examId": "jee-advanced", "year": "2024", "cutoff": "CSE: 607 | ECE: 1610 | MnC: 1120", "source": "JoSAA 2024"}
    ],

    # NITs (JEE Main 2024 - General - OS Quota - Round 6)
    "nit-trichy": [
        {"examId": "jee-main", "year": "2024", "cutoff": "CSE: 1500 | ECE: 4600 | Mech: 10500", "source": "JoSAA 2024"}
    ],
    "nit-karnataka-surathkal": [
        {"examId": "jee-main", "year": "2024", "cutoff": "CSE: 2300 | AI: 2800 | ECE: 5800", "source": "JoSAA 2024"}
    ],
    "nit-calicut": [
        {"examId": "jee-main", "year": "2024", "cutoff": "CSE: 4500 | ECE: 9000 | EEE: 16000", "source": "JoSAA 2024"}
    ],
    "nit-warangal": [
        {"examId": "jee-main", "year": "2024", "cutoff": "CSE: 2900 | ECE: 6500 | Biotech: 35000", "source": "JoSAA 2024"}
    ],
    "nit-rourkela": [
        {"examId": "jee-main", "year": "2024", "cutoff": "CSE: 3800 | ECE: 8200 | Mech: 18000", "source": "JoSAA 2024"}
    ],

    # IIMs (CAT 2023 - General Category)
    "iim-ahm": [
        {"examId": "cat", "year": "2023", "cutoff": "Overall: 99.6+ | VARC: 99 | DILR: 99 | QA: 99", "source": "IIM A Admission"}
    ],
    "iim-bangalore": [
        {"examId": "cat", "year": "2023", "cutoff": "Overall: 99.0+ | Sectional: 80+ (High Weightage to Profile)", "source": "IIM B Admission"}
    ],
    "iim-calcutta": [
        {"examId": "cat", "year": "2023", "cutoff": "Overall: 99.4+ | Sectional: 85+", "source": "IIM C Admission"}
    ],
    "iim-lucknow": [
        {"examId": "cat", "year": "2023", "cutoff": "Overall: 90+ (Actual Call: ~98+)", "source": "IIM L Admission"}
    ],
    "iim-indore": [
        {"examId": "cat", "year": "2023", "cutoff": "Overall: 90+ (Actual Call: ~97+)", "source": "IIM I Admission"},
        {"examId": "ipmat", "year": "2024", "cutoff": "AT (SA): 12 | AT (MCQ): 39 | VA: 98", "source": "Official"}
    ],
    "iim-kozhikode": [
        {"examId": "cat", "year": "2023", "cutoff": "Overall: 85+ (Actual Call: ~97+)", "source": "IIM K Admission"}
    ]
}

def update_college_cutoffs(models_dir):
    """Update all college JSON files with cutoff data"""
    models_path = Path(models_dir)
    
    if not models_path.exists():
        print(f"Error: Directory {models_dir} does not exist")
        return
    
    college_files = list(models_path.glob("*_Colleges.json"))
    updated_count = 0
    
    for file_path in college_files:
        print(f"Processing {file_path.name}...")
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
            
            # Handle Wrapper
            if isinstance(data, dict) and 'institutions' in data:
                colleges = data['institutions']
                is_wrapper = True
            else:
                colleges = data
                is_wrapper = False

            file_updated = False
            for college in colleges:
                college_id = college.get('id')
                if college_id in CUTOFF_DATA:
                    college['pastCutoffs'] = CUTOFF_DATA[college_id]
                    print(f"  ✓ Updated Cutoffs for {college.get('name', college_id)}")
                    updated_count += 1
                    file_updated = True
            
            # Write back
            if file_updated:
                with open(file_path, 'w', encoding='utf-8') as f:
                    if is_wrapper:
                        json.dump(data, f, indent=2, ensure_ascii=False)
                    else:
                        json.dump(colleges, f, indent=2, ensure_ascii=False)
        
        except Exception as e:
            print(f"  ✗ Error processing {file_path.name}: {e}")
    
    print(f"\n✓ Updated {updated_count} colleges with verified cutoff data")

if __name__ == "__main__":
    models_directory = r"e:\CMAT-PROBLEM\backend\models"
    update_college_cutoffs(models_directory)
