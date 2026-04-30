const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log("Checking IIT Delhi in engineering_cutoffs...");
    const cutoff = await db.collection("engineering_cutoffs").findOne({ institute_name_raw: /Indian Institute of Technology Delhi/i });
    console.log("Cutoff Record:", JSON.stringify(cutoff, null, 2));

    console.log("\nChecking IIT Delhi in seat_matrix...");
    const seat = await db.collection("seat_matrix").findOne({ institute_name_raw: /Indian Institute of Technology Delhi/i });
    console.log("Seat Record:", JSON.stringify(seat, null, 2));

  } finally {
    await client.close();
  }
}

main().catch(console.error);
