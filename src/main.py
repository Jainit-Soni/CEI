import os
from extract import extract_from_mongo
from identity import generate_cei_ids
from deduplicate import deduplicate_and_log
from reconcile import generate_reconciliation_report

def main():
    os.makedirs('output/verified', exist_ok=True)
    os.makedirs('output/audit', exist_ok=True)
    
    print("1. Extracting Data from MongoDB...")
    df = extract_from_mongo()
    
    print("2. Generating CEI Canonical IDs...")
    df = generate_cei_ids(df)
    
    print("3. Executing Strict Deduplication...")
    df_clean, init_count = deduplicate_and_log(
        df, 
        default_out="output/audit/duplicate_log.csv", 
        removal_out="output/audit/removal_log.csv"
    )
    
    print("4. Running Reconciliation Engine...")
    generate_reconciliation_report(df_clean, init_count, "output/audit/reconciliation_summary.json")
    
    print("5. Exporting Verified Master Outputs...")
    columns_to_keep = [
        'cei_id', 'institution_name', 'category', 'state', 'district',
        'university_affiliation', 'source_year', 'verification_status', 'aishe_code',
        'naac_grade', 'established_year'
    ]
    
    final_cols = [c for c in columns_to_keep if c in df_clean.columns]
    
    df_clean[final_cols].to_csv('output/verified/master_verified_institutions.csv', index=False)
    
    # Save the json records properly
    df_clean[final_cols].to_json('output/verified/master_verified_institutions.json', orient='records', lines=True)

    print("Phase 1 Execution Complete. Output saved to 'output/verified' and logs in 'output/audit'.")

if __name__ == "__main__":
    main()
