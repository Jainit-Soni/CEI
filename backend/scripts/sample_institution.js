const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const doc = await db.collection("institutions").findOne({});
    console.log(JSON.stringify(doc, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(console.error);
