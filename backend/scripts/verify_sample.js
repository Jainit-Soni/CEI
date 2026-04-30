const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

const ids = [
    "CORE-IIT-BOMBAY", "CORE-IIT-DELHI", "CORE-IIT-MADRAS", "CORE-IIT-KANPUR", "CORE-IIT-KHARAGPUR",
    "CORE-NIT-TRICHY", "CORE-NIT-SURATHKAL", "CORE-NIT-WARANGAL", "CORE-NIT-ROURKELA", "CORE-NIT-CALICUT",
    "CORE-IIIT-ALLAHABAD", "CORE-IIIT-GWALIOR", "CORE-IIIT-JABALPUR", "CORE-IIIT-KANCHEEPURAM", "CORE-IIIT-KOTTAYAM",
    "CORE-BIT-MESRA", "CORE-PEC-CHANDIGARH", "CORE-JNU-DELHI", "CORE-HYDERABAD-UNIVERSITY", "CORE-SMVDU-KATRA"
];

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const results = await db.collection("institutions").find({ institution_id: { $in: ids } }).toArray();
    console.log(JSON.stringify(results.map(r => ({ id: r.institution_id, name: r.name })), null, 2));
  } finally {
    await client.close();
  }
}

main().catch(console.error);
