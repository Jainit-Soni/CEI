const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    const nits = await db.collection("institutions").find({ name: /^National Institute of Technology/, isCore: true }).limit(5).toArray();
    const iiits = await db.collection("institutions").find({ name: /^Indian Institute of Information Technology/, isCore: true }).limit(5).toArray();
    const others = await db.collection("institutions").find({ isCore: true, name: { $not: /(IIT|NIT|IIIT|Technology|Management)/ } }).limit(5).toArray();

    const results = [...nits, ...iiits, ...others];
    console.log(JSON.stringify(results.map(r => ({ id: r.institution_id || r.id, name: r.name })), null, 2));
  } finally {
    await client.close();
  }
}

main().catch(console.error);
