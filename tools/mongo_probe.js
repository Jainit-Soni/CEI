const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.CEI_DB || "cei_v2";

const collection = process.argv[2];
const queryArg = process.argv[3] || "{}";
const limit = Number(process.argv[4] || 5);

if (!collection) {
  console.error("Usage: node tools/mongo_probe.js <collection> '<queryJson>' <limit>");
  process.exit(1);
}

async function main() {
  let query;

  try {
    query = JSON.parse(queryArg);
  } catch (err) {
    console.error("Invalid query JSON:", queryArg);
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const docs = await db
      .collection(collection)
      .find(query)
      .limit(limit)
      .toArray();

    console.log(JSON.stringify({
      db: DB_NAME,
      collection,
      query,
      count: docs.length,
      docs
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});