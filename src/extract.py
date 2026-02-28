import os
from pymongo import MongoClient
import pandas as pd

def extract_from_mongo(uri="mongodb://JAINIT:Uu4mAS9IQ7Q9NEX4@ac-jmm94uu-shard-00-00.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-01.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-02.shlqnzg.mongodb.net:27017/cei?ssl=true&authSource=admin&retryWrites=true"):
    print("Connecting to MongoDB...")
    client = MongoClient(uri)
    db = client.get_database()
    collection = db['colleges']
    
    print(f"Extracting records from 'colleges' collection...")
    cursor = collection.find({})
    
    data = []
    for doc in cursor:
        meta = doc.get('meta', {})
        
        affiliations = meta.get('affiliations', [])
        affiliation = affiliations[0] if affiliations else None
        
        row = {
            'aishe_code': doc.get('aisheCode') or doc.get('id'),
            'institution_name': doc.get('name'),
            'category': doc.get('rankingTier'),
            'state': doc.get('state'),
            'district': meta.get('district') or doc.get('location'),
            'university_affiliation': affiliation,
            'source_year': '2020-21',
            'verification_status': 'UNVERIFIED',
            'is_premium': doc.get('isPremium', False),
            'naac_grade': meta.get('naacGrade'),
            'established_year': meta.get('establishedYear')
        }
        data.append(row)
        
    df = pd.DataFrame(data)
    print(f"Extracted {len(df)} records from MongoDB.")
    
    def map_category(cat):
        if not cat: return 'College'
        cat_upper = cat.upper()
        if 'UNIV' in cat_upper: return 'University'
        if 'STAND ALONE' in cat_upper or 'STANDALONE' in cat_upper: return 'Standalone'
        return 'College'
        
    df['category'] = df['category'].apply(map_category)
    return df
