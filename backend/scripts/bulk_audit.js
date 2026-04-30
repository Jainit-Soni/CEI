const axios = require('axios');
const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";
const BASE_URL = "http://localhost:4000";

const auditIds = [
    "CORE-IIT-BOMBAY", "CORE-IIT-DELHI", "CORE-IIT-KANPUR", "CORE-IIT-KHARAGPUR", "CORE-IIT-MADRAS",
    "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-SILCHAR", "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-PATNA", "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-RAIPUR", "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-DELHI", "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-GOA",
    "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-DHARWAD", "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-DESIGN-AND-MANUFACTURING-KURNOOL", "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-DESIGN-MANUFACTURING-KANCHEEPURAM", "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-AGARTALA", "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-ALLAHABAD",
    "CORE-BIT-MESRA", "CORE-PEC-CHANDIGARH", "CORE-BITS-PILANI", "CORE-INDIAN-INSTITUTE-OF-SCIENCE", "CORE-AIIMS-DELHI"
];

async function checkDb(db, id) {
    const cutoffs = await db.collection("engineering_cutoffs").countDocuments({ institution_id: id });
    const seats = await db.collection("seat_matrix").countDocuments({ institution_id: id });
    return { cutoffs, seats };
}

async function audit() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const results = [];

  for (const id of auditIds) {
    console.log(`Auditing ${id}...`);
    let apiData = null;
    let apiError = null;
    
    try {
      const response = await axios.get(`${BASE_URL}/api/college/${id}`, { timeout: 10000 });
      apiData = response.data.college;
    } catch (err) {
      apiError = err.message;
    }

    // Secondary verification via Truth APIs
    let truthSeats = 0;
    try {
        const tsRes = await axios.get(`${BASE_URL}/api/colleges/${id}/truth/seats`, { timeout: 5000 });
        truthSeats = tsRes.data.items?.length || 0;
    } catch (e) {}

    const dbStats = await checkDb(db, id);
    
    let classification = "UNKNOWN";
    if (apiData) {
        const hasCutoffs = apiData.engineeringCutoffs && apiData.engineeringCutoffs.length > 0;
        const hasSeats = apiData.seats && apiData.seats.length > 0;
        
        if (hasCutoffs && hasSeats) classification = "PASS";
        else if (hasCutoffs || hasSeats) classification = "PARTIAL";
        else if (dbStats.cutoffs > 0 || dbStats.seats > 0) {
            classification = "F3: API not returning (Aggregation Issue)";
        } else {
            classification = "F1: No data in DB";
        }
    } else {
        classification = "F3: API Error / 404";
    }

    results.push({
        id,
        name: apiData?.name || "Unknown",
        dbCutoffs: dbStats.cutoffs,
        dbSeats: dbStats.seats,
        apiCutoffs: apiData?.engineeringCutoffs?.length || 0,
        apiSeats: apiData?.seats?.length || 0,
        truthSeats,
        classification
    });
  }

  console.log(JSON.stringify(results, null, 2));
  await client.close();
}

audit().catch(console.error);
