const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.CEI_DB || "cei_v2";

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const oldId = "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-MUMBAI";
    const newId = "CORE-IIT-BOMBAY";
    const newName = "Indian Institute of Technology Bombay";

    const collections = ["institutions", "engineering_cutoffs", "seat_matrix", "course_offerings", "rankings"];

    for (const col of collections) {
      const result = await db.collection(col).updateMany(
        { institution_id: oldId },
        { $set: { institution_id: newId } }
      );
      console.log(`Updated institution_id in ${col}: ${result.modifiedCount} documents`);

      const resultId = await db.collection(col).updateMany(
        { id: oldId },
        { $set: { id: newId } }
      );
      console.log(`Updated id in ${col}: ${resultId.modifiedCount} documents`);

      // Also update name if it exists and matches the incorrect variant
      const resultName = await db.collection(col).updateMany(
        { institution_name: "Indian Institute of Technology, Mumbai" },
        { $set: { institution_name: newName } }
      );
      console.log(`Updated institution_name in ${col}: ${resultName.modifiedCount} documents`);
      
      const resultName2 = await db.collection(col).updateMany(
        { name: "Indian Institute of Technology, Mumbai" },
        { $set: { name: newName } }
      );
      console.log(`Updated name in ${col}: ${resultName2.modifiedCount} documents`);
    }

    // Special case for institutions collection where _id might be the oldId
    const college = await db.collection("institutions").findOne({ _id: oldId });
    if (college) {
      console.log("Found institution record with old ID as _id. Merging...");
      const targetCollege = await db.collection("institutions").findOne({ _id: newId });
      if (targetCollege) {
        console.log("Target institution (CORE-IIT-BOMBAY) already exists. Deleting old record.");
        await db.collection("institutions").deleteOne({ _id: oldId });
      } else {
        console.log("Target institution (CORE-IIT-BOMBAY) does not exist. Renaming old record.");
        const newCollege = { ...college, _id: newId, id: newId, name: newName, canonicalName: newName };
        await db.collection("institutions").insertOne(newCollege);
        await db.collection("institutions").deleteOne({ _id: oldId });
      }
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
