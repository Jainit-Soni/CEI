const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collections = await db.listCollections().toArray();
    
    console.log("Collections containing institution_id:");
    for (const coll of collections) {
        const count = await db.collection(coll.name).countDocuments({ institution_id: { $exists: true } });
        if (count > 0) {
            console.log(`- ${coll.name}: ${count} records`);
        }
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
