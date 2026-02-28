import hashlib

def generate_cei_ids(df):
    def make_id(row):
        base = f"{row.get('aishe_code', '')}_{row.get('institution_name', '')}_{row.get('state', '')}"
        hash_hex = hashlib.sha256(base.encode('utf-8')).hexdigest()[:12]
        return f"CEI-IN-{hash_hex.upper()}"
        
    df['cei_id'] = df.apply(make_id, axis=1)
    return df
