import json

OFFICIAL_COUNTS = {
    'University': 1113,
    'College': 43796,
    'Standalone': 11296
}

def generate_reconciliation_report(df_clean, initial_count, out_path="output/audit/reconciliation_summary.json"):
    counts = df_clean['category'].value_counts().to_dict()
    
    report = {
        "metrics": {
            "total_raw_rows": initial_count,
            "final_verified_total": len(df_clean),
            "total_removed": initial_count - len(df_clean)
        },
        "category_breakdown": {}
    }
    
    for cat, official in OFFICIAL_COUNTS.items():
        actual = counts.get(cat, 0)
        variance = actual - official
        report["category_breakdown"][cat] = {
            "official_target": official,
            "actual_verified": str(actual), # Cast numpy to string for json
            "variance": str(variance),
            "variance_percent": str(round(abs(variance) / official * 100, 2))
        }
        
    with open(out_path, 'w') as f:
        json.dump(report, f, indent=4)
        
    md_path = out_path.replace('.json', '.md')
    with open(md_path, 'w') as f:
        f.write("# Reconciliation Summary\n\n")
        f.write(f"- **Raw Count**: {initial_count}\n")
        f.write(f"- **Verified Count**: {len(df_clean)}\n")
        f.write(f"- **Removed**: {initial_count - len(df_clean)}\n\n")
        f.write("## Category Breakdown\n")
        for k, v in report["category_breakdown"].items():
            f.write(f"- **{k}**: {v['actual_verified']} (Target: {v['official_target']}, Variance: {v['variance']})\n")
    
    print("Reconciliation report generated.")
    
    total_target = sum(OFFICIAL_COUNTS.values())
    total_actual = len(df_clean)
    global_variance_pct = abs(total_actual - total_target) / total_target
    
    if global_variance_pct > 0.01:
        print(f"WARNING: Global variance exceeds 1%. Current variance: {global_variance_pct*100:.2f}% (Target: {total_target}, Actual: {total_actual})")
        print("Proceeding to Phase 2 for surplus resolution resolution.")
