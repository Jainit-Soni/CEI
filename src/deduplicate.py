import pandas as pd

def deduplicate_and_log(df, default_out="output/audit/duplicate_log.csv", removal_out="output/audit/removal_log.csv"):
    initial_count = len(df)
    
    # 1. Blank/Invalid Removals
    blanks = df[df['institution_name'].isnull() | df['state'].isnull()].copy()
    blanks['removal_reason'] = 'MISSING_CRITICAL_FIELD'
    df_clean = df.dropna(subset=['institution_name', 'state'])
    
    blanks.to_csv(removal_out, index=False)
    
    # 1.5. Strict AISHE Format Filtering
    # Drop records where 'aishe_code' does not look like U-XXX, C-XXX, S-XXX
    valid_mask = df_clean['aishe_code'].str.match('^[UCSucs]-', na=False)
    invalid_aishe = df_clean[~valid_mask].copy()
    if not invalid_aishe.empty:
        invalid_aishe['removal_reason'] = 'INVALID_AISHE_FORMAT'
        logs = [invalid_aishe]
    else:
        logs = []
        
    df_clean = df_clean[valid_mask].copy()

    # 2. Strict Deduplication
    dupes_aishe = df_clean[df_clean.duplicated(subset=['aishe_code'], keep='first') & df_clean['aishe_code'].notnull()]
    if not dupes_aishe.empty:
        dupes_aishe = dupes_aishe.copy()
        dupes_aishe['removal_reason'] = 'DUPLICATE_AISHE_CODE'
        logs.append(dupes_aishe)
        df_clean = df_clean.drop_duplicates(subset=['aishe_code'], keep='first')
        
    # Secondary: Name + District
    dupes_name_loc = df_clean[df_clean.duplicated(subset=['institution_name', 'district'], keep='first')]
    if not dupes_name_loc.empty:
        dupes_name_loc = dupes_name_loc.copy()
        dupes_name_loc['removal_reason'] = 'DUPLICATE_NAME_DISTRICT'
        logs.append(dupes_name_loc)
        df_clean = df_clean.drop_duplicates(subset=['institution_name', 'district'], keep='first')
        
    # Tertiary: Name + Affiliation
    if 'university_affiliation' in df_clean.columns:
        dupes_affil = df_clean[df_clean.duplicated(subset=['institution_name', 'university_affiliation'], keep='first')]
        if not dupes_affil.empty:
            dupes_affil = dupes_affil.copy()
            dupes_affil['removal_reason'] = 'DUPLICATE_NAME_AFFILIATION'
            logs.append(dupes_affil)
            df_clean = df_clean.drop_duplicates(subset=['institution_name', 'university_affiliation'], keep='first')
            
    if logs:
        pd.concat(logs).to_csv(default_out, index=False)
    else:
        pd.DataFrame().to_csv(default_out, index=False)
        
    df_clean['verification_status'] = 'VERIFIED'
    
    return df_clean, initial_count
