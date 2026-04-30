const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    const iits = await db.collection("institutions").find({ name: /Indian Institute of Technology/ }).toArray();
    
    const shortIits = iits.filter(i => (i.institution_id || i.id).includes("-IIT-"));
    const longIits = iits.filter(i => (i.institution_id || i.id).includes("-INDIAN-INSTITUTE-OF-TECHNOLOGY-"));
    
    const pairs = [];
    
    for (const s of shortIits) {
        const sId = s.institution_id || s.id;
        const city = sId.replace('CORE-IIT-', '');
        
        // Find matching long one
        const match = longIits.find(l => {
            const lId = l.institution_id || l.id;
            return lId.includes(city) || l.name.toLowerCase().includes(city.toLowerCase());
        });
        
        if (match) {
            pairs.push({
                canonical: sId,
                legacy: match.institution_id || match.id,
                name: s.name
            });
        }
    }
    
    console.log(JSON.stringify(pairs, null, 2));

  } finally {
    await client.close();
  }
}

main().catch(console.error);
