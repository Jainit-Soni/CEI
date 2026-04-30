const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    const iits = await db.collection("institutions").find({ name: /Indian Institute of Technology/ }).limit(5).toArray();
    const nits = await db.collection("institutions").find({ name: /National Institute of Technology/ }).limit(5).toArray();
    const iiits = await db.collection("institutions").find({ name: /Indian Institute of Information Technology/ }).limit(5).toArray();
    const gftis = await db.collection("institutions").find({ isCore: true, name: { $not: /(IIT|NIT|IIIT|Technology)/ } }).limit(5).toArray();

    const sample = [...iits, ...nits, ...iiits, ...gftis];
    console.log(JSON.stringify(sample.map(i => ({ id: i.institution_id || i.id, name: i.name })), null, 2));
  } finally {
    await client.close();
  }
}

main().catch(console.error);
