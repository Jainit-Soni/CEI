const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    const collections = ["engineering_cutoffs", "seat_matrix", "course_offerings"];
    for (const col of collections) {
      const count = await db.collection(col).countDocuments({ institution_id: "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-MUMBAI" });
      console.log(`Count in ${col} for old ID: ${count}`);
      
      const countNew = await db.collection(col).countDocuments({ institution_id: "CORE-IIT-BOMBAY" });
      console.log(`Count in ${col} for new ID: ${countNew}`);
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
