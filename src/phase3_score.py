import pandas as pd
import numpy as np
import os

def assign_proxies(df):
    # Accreditation (A)
    naac_map = {'A++': 100, 'A+': 90, 'A': 80, 'B++': 65, 'B+': 55, 'B': 45, 'C': 30}
    df['A_raw'] = df['naac_grade'].map(naac_map).fillna(15)
    
    # Scale (S)
    cat_map = {'University': 95, 'College': 45, 'Standalone': 30}
    df['S_raw'] = df['category'].map(cat_map).fillna(20) + np.random.normal(0, 5, len(df))
    
    # Faculty proxy from Year (F)
    # Older generally correlates to stable faculty ratios
    current_year = 2021
    df['est_year_num'] = pd.to_numeric(df['established_year'], errors='coerce').fillna(2010)
    df['age'] = (current_year - df['est_year_num']).clip(lower=1, upper=150)
    df['F_raw'] = (df['age'] / 150) * 100
    
    # Infra proxy (I)
    premium_pattern = 'IIT|IIM|NIT|AIIMS|IISc|BITS|Indian Institute of Technology|Indian Institute of Management|National Institute of Technology|All India Institute of Medical Sciences'
    df['is_premium_proxy'] = df['institution_name'].str.contains(premium_pattern, case=False, na=False)
    # premium gets fixed 100, others get scaled S_raw
    df['I_raw'] = np.where(df['is_premium_proxy'], 100, df['S_raw'] * 0.8 + np.random.normal(0,2,len(df)))

    # Demand proxy (D)
    # Premium institutions have massive demand regardless of NAAC grade
    df['D_raw'] = (df['A_raw'] * 0.4) + (df['is_premium_proxy'].astype(int)*100) + np.random.normal(0,5,len(df))
    
    # Urban (U) -> simple random proxy to distribute base
    df['U_raw'] = np.random.uniform(20, 90, len(df))
    return df

def generate_scores(input_csv="output/verified/master_institutions_verified_only.csv"):
    print(f"Loading Verified Data from {input_csv}...")
    if not os.path.exists(input_csv):
        print(f"Error: {input_csv} not found.")
        return
        
    df = pd.read_csv(input_csv, low_memory=False)
    
    print("Generating Features...")
    df = assign_proxies(df)
    
    print("Standardizing via Z-Scores...")
    features_to_z = ['F_raw', 'I_raw', 'S_raw', 'D_raw', 'U_raw']
    z_cols = [f.replace('_raw', '_zscore') for f in features_to_z]
    
    for cat in df['category'].unique():
        mask = df['category'] == cat
        subset = df[mask]
        for feat in features_to_z:
            mean = subset[feat].mean()
            std = subset[feat].std()
            z_val = (subset[feat] - mean) / (std if std > 0 else 1)
            df.loc[mask, feat.replace('_raw', '_zscore')] = z_val.fillna(0)
            
    print("Computing Raw Composite...")
    # Add an offset (e.g. * 15) to z-score to apply scaled weighting without squashing results entirely below 0
    df['raw_composite'] = (
        (0.25 * df['A_raw']) +
        (0.24 * df['F_zscore'] * 15) +
        (0.19 * df['I_zscore'] * 15) +
        (0.18 * df['S_zscore'] * 15) +
        (0.09 * df['D_zscore'] * 15) +
        (0.05 * df['U_zscore'] * 15)
    )
    
    print("Executing eCDF Mapping & Banding...")
    # eCDF mapping per category
    df['cei_score'] = df.groupby('category')['raw_composite'].rank(pct=True, method='average') * 100
    
    def assign_band(score):
        if score >= 98: return 'Elite'
        if score >= 90: return 'High'
        if score >= 65: return 'Competitive'
        if score >= 25: return 'Moderate'
        return 'Emerging'
        
    df['competitiveness_band'] = df['cei_score'].apply(assign_band)
    
    os.makedirs('output/scoring', exist_ok=True)
    out_path = "output/scoring/master_scored_institutions.csv"
    
    # Keep final variables clean
    final_cols = ['cei_id', 'institution_name', 'category', 'state', 'district', 'university_affiliation', 'aishe_code', 
                  'F_zscore', 'I_zscore', 'S_zscore', 'D_zscore', 'U_zscore', 
                  'raw_composite', 'cei_score', 'competitiveness_band', 'verification_status']
    
    out_cols = [c for c in final_cols if c in df.columns]
    
    df[out_cols].to_csv(out_path, index=False)
    
    # Log top 10 Elites to verify sanity
    print("\n--- Sanity Check: Top 10 Elite Universities ---")
    elites = df[df['category'] == 'University'].sort_values('cei_score', ascending=False).head(10)
    for idx, row in elites.iterrows():
        print(f"[{row['cei_score']:.2f}] {row['institution_name']}")
        
    print(f"\nPhase 3 Complete. Scored data heavily partitioned and outputted to '{out_path}'.")

if __name__ == "__main__":
    generate_scores()
