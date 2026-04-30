const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

const mismatchedIds = [
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-BHILAI',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-DELHI',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-DHARWAD',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-GANDHINAGAR',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-GOA',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-GUWAHATI',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-HYDERABAD',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-INDORE',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-JAMMU',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-JODHPUR',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-KANPUR',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-KHARAGPUR',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-MANDI',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-PALAKKAD',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-PATNA',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-ROORKEE',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-ROPAR',
  'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-TIRUPATI'
];

function getCanonical(id) {
    return id.replace('CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-', 'CORE-IIT-');
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    const mappings = mismatchedIds.map(oldId => ({ oldId, newId: getCanonical(oldId) }));
    
    console.log("Verifying canonical IDs in institutions collection...");
    const results = [];
    for (const m of mappings) {
        const inst = await db.collection("institutions").findOne({ institution_id: m.newId });
        results.push({ ...m, existsInInstitutions: !!inst });
    }
    
    console.log(JSON.stringify(results, null, 2));

  } finally {
    await client.close();
  }
}

main().catch(console.error);
