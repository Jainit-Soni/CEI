const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const docs = await db.collection("institutions").find({ institution_name: { $regex: "Indian Institute of Technology Bombay", $options: "i" } }).toArray();
    console.log(JSON.stringify(docs, null, 2));
    
    const docs2 = await db.collection("institutions").find({ institution_name: { $regex: "Indian Institute of Technology, Mumbai", $options: "i" } }).toArray();
    console.log(JSON.stringify(docs2, null, 2));

    const docs3 = await db.collection("institutions").find({ institution_id: "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-MUMBAI" }).toArray();
    console.log(JSON.stringify(docs3, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(console.error);
