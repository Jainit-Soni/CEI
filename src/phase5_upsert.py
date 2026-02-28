import pandas as pd
from pymongo import MongoClient, UpdateOne
import math
import datetime

URI = "mongodb://JAINIT:Uu4mAS9IQ7Q9NEX4@ac-jmm94uu-shard-00-00.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-01.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-02.shlqnzg.mongodb.net:27017/cei?ssl=true&authSource=admin&retryWrites=true"

def upsert_to_mongo(csv_path="output/scoring/master_scored_institutions.csv"):
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} scored institutions.")
    
    print("Connecting to MongoDB Atlas...")
    client = MongoClient(URI)
    db = client.get_database() # gets 'cei'
    col = db['colleges']
    
    operations = []
    batch_size = 1000
    total_processed = 0
    now = datetime.datetime.utcnow()
    
    for idx, row in df.iterrows():
        # Handle nan scores just in case
        score = row['cei_score'] if pd.notnull(row['cei_score']) else 0.0
        
        # We match on either 'aisheCode' or 'id' since raw ingestion used 'id' heavily
        query = {"$or": [
            {"aisheCode": row['aishe_code']},
            {"id": row['aishe_code']}
        ]}
        
        update = {"$set": {
            "ceiScore": float(score),
            "competitivenessBand": str(row['competitiveness_band']),
            "verificationStatus": str(row['verification_status']),
            "canonicalId": str(row['cei_id']),
            "lastScoreUpdate": now
        }}
        
        operations.append(UpdateOne(query, update, upsert=False))
        
        # Execute batch
        if len(operations) >= batch_size:
            try:
                result = col.bulk_write(operations, ordered=False)
                total_processed += len(operations)
                print(f"[{total_processed}/{len(df)}] Bulk Write Result - Matched: {result.matched_count}, Modified: {result.modified_count}")
            except Exception as e:
                print(f"Error executing batch: {e}")
            operations = []
            
    # Final flush
    if operations:
        try:
            result = col.bulk_write(operations, ordered=False)
            total_processed += len(operations)
            print(f"[{total_processed}/{len(df)}] Final Write - Matched: {result.matched_count}, Modified: {result.modified_count}")
        except Exception as e:
            print(f"Error executing final batch: {e}")

    print("Phase 5 Upsert Complete!")

if __name__ == "__main__":
    upsert_to_mongo()
