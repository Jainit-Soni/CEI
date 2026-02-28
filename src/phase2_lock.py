import pandas as pd
import os

def finalize_identities(input_csv="output/verified/master_verified_institutions.csv"):
    df = pd.read_csv(input_csv, low_memory=False)
    initial_count = len(df)
    print(f"Phase 2 Start: {initial_count} records.")

    # Goal: Get down to ~56,205 official records using Inner Joins (Option C) and Metadata (Option A)
    downgrade_log = []
    
    # Step 1: Filter by Metadata (Option A)
    # We drop unverified generic entries missing BOTH naacGrade and establishedYear
    # unless they are explicitly marked as "Premium" in our DB.
    # Actually, we don't have is_premium in the CSV output. Let's just drop if missing both NAAC & established_year, 
    # BUT caution: many valid colleges might lack NAAC and established_year in our DB.
    # Let's instead perform Option C: Inner join with the actual raw AISHE Excel files.

    excel_colleges = "backend/College-ALL COLLEGE.xlsx"
    excel_standalone = "backend/Standalone-ALL STANDALONE.xlsx"
    excel_universities = "backend/University-ALL UNIVERSITIES.xlsx"
    
    valid_aishe_codes = set()
    
    for file_path in [excel_colleges, excel_standalone, excel_universities]:
        if os.path.exists(file_path):
            print(f"Reading official AISHE source: {file_path}")
            # The column is usually 'id' or 'AISHE Code'. Let's read the first 100 rows to find it.
            try:
                # Read specific headers
                temp_df = pd.read_excel(file_path, header=2)
                # Find the aishe column
                aishe_col = [c for c in temp_df.columns if 'AISHE' in str(c).upper() or str(c).lower() == 'id']
                if aishe_col:
                    valid_aishe_codes.update(temp_df[aishe_col[0]].dropna().astype(str).tolist())
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
                
    if valid_aishe_codes:
        print(f"Total valid AISHE codes collected from Excel sources: {len(valid_aishe_codes)}")
        
        # Identify missing
        mask_not_in_official = ~df['aishe_code'].isin(valid_aishe_codes)
        downgrades_official = df[mask_not_in_official].copy()
        
        if not downgrades_official.empty:
            downgrades_official['removal_reason'] = 'NOT_IN_OFFICIAL_AISHE_EXCEL'
            downgrade_log.append(downgrades_official)
            df.loc[mask_not_in_official, 'verification_status'] = 'UNVERIFIED_NOT_IN_SOURCE'
    else:
        print("Warning: Could not read official Excel lists. Using Metadata fallback (Option A)...")
        # Option A Fallback: Remove ones lacking established year OR NAAC if we have a massive surplus
        mask_missing_vital = df['established_year'].isnull() & df['naac_grade'].isnull()
        downgrades_meta = df[mask_missing_vital].copy()
        downgrades_meta['removal_reason'] = 'MISSING_VITAL_METADATA'
        downgrade_log.append(downgrades_meta)
        df.loc[mask_missing_vital, 'verification_status'] = 'UNVERIFIED_MISSING_META'
        
    df_verified = df[df['verification_status'] == 'VERIFIED']
    
    if downgrade_log:
        pd.concat(downgrade_log).to_csv("output/audit/canonical_lock_log.csv", index=False)
        
    df.to_csv("output/verified/master_institutions_all.csv", index=False)
    df_verified.to_csv("output/verified/master_institutions_verified_only.csv", index=False)
    
    print(f"Phase 2 Complete. Strictly Verified: {len(df_verified)} | Unverified/Archived: {len(df) - len(df_verified)}")

if __name__ == "__main__":
    finalize_identities()
