const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const docs = await db.collection("institutions").find({ name: /Mandi/i }).toArray();
    console.log(JSON.stringify(docs.map(r => ({ id: r.institution_id || r.id, name: r.name })), null, 2));
  } finally {
    await client.close();
  }
}

main().catch(console.error);
