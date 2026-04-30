const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log("Identifying mismatched IIT IDs in engineering_cutoffs...");
    const cutoffIds = await db.collection("engineering_cutoffs").distinct("institution_id", { institution_id: /^CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-/ });
    console.log("Mismatched IDs in engineering_cutoffs:", cutoffIds);

    console.log("\nIdentifying mismatched IIT IDs in seat_matrix...");
    const seatIds = await db.collection("seat_matrix").distinct("institution_id", { institution_id: /^CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-/ });
    console.log("Mismatched IDs in seat_matrix:", seatIds);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
