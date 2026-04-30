const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    const iits = await db.collection("institutions").find({ name: /Indian Institute of Technology/ }).toArray();
    
    const results = iits.map(i => ({
        name: i.name,
        institution_id: i.institution_id || i.id,
        isShort: (i.institution_id || i.id).includes("-IIT-")
    }));
    
    console.log(JSON.stringify(results, null, 2));

  } finally {
    await client.close();
  }
}

main().catch(console.error);
