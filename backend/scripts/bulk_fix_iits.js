const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb://127.0.0.1:27017";
const DB_NAME = "cei_v2";

const pairs = [
  {
    "canonical": "CORE-IIT-DELHI",
    "legacy": "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-DELHI",
    "name": "Indian Institute of Technology Delhi"
  },
  {
    "canonical": "CORE-IIT-KANPUR",
    "legacy": "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-KANPUR",
    "name": "Indian Institute of Technology Kanpur"
  },
  {
    "canonical": "CORE-IIT-KHARAGPUR",
    "legacy": "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-KHARAGPUR",
    "name": "Indian Institute of Technology Kharagpur"
  },
  {
    "canonical": "CORE-IIT-ROORKEE",
    "legacy": "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-ROORKEE",
    "name": "Indian Institute of Technology Roorkee"
  },
  {
    "canonical": "CORE-IIT-GUWAHATI",
    "legacy": "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-GUWAHATI",
    "name": "Indian Institute of Technology Guwahati"
  },
  {
    "canonical": "CORE-IIT-HYDERABAD",
    "legacy": "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-HYDERABAD",
    "name": "Indian Institute of Technology Hyderabad"
  },
  {
    "canonical": "CORE-IIT-BOMBAY",
    "legacy": "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-MUMBAI",
    "name": "Indian Institute of Technology Bombay"
  }
];

const collections = ["engineering_cutoffs", "seat_matrix", "course_offerings"];

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log("=== IIT BULK IDENTITY STANDARDIZATION DRY-RUN ===");
    
    for (const pair of pairs) {
        console.log(`\nProcessing: ${pair.name}`);
        console.log(`  Legacy ID: ${pair.legacy}`);
        console.log(`  Canonical ID: ${pair.canonical}`);
        
        for (const coll of collections) {
            const legacyCount = await db.collection(coll).countDocuments({ institution_id: pair.legacy });
            const canonicalCount = await db.collection(coll).countDocuments({ institution_id: pair.canonical });
            console.log(`  - ${coll}: Legacy(${legacyCount}) | Canonical(${canonicalCount})`);
            
            if (legacyCount > 0 && canonicalCount > 0) {
                console.log(`  [WARNING] Conflict in ${coll}! Both IDs exist. Manual merge required?`);
            }
        }
        
        const instLegacy = await db.collection("institutions").findOne({ institution_id: pair.legacy });
        const instCanonical = await db.collection("institutions").findOne({ institution_id: pair.canonical });
        console.log(`  - institutions: Legacy(${instLegacy ? 'YES' : 'NO'}) | Canonical(${instCanonical ? 'YES' : 'NO'})`);
    }

    const dryRunOnly = process.argv.includes('--dry-run');
    if (dryRunOnly) {
        console.log("\nDry-run complete. Run without --dry-run to execute.");
        return;
    }

    console.log("\n=== EXECUTING MIGRATION ===");
    
    for (const pair of pairs) {
        console.log(`\nStandardizing: ${pair.name}`);
        
        for (const coll of collections) {
            // Update truth data
            const result = await db.collection(coll).updateMany(
                { institution_id: pair.legacy },
                { $set: { institution_id: pair.canonical } }
            );
            console.log(`  - ${coll}: Updated ${result.modifiedCount} records.`);
        }
        
        // Purge legacy catalog node
        const delResult = await db.collection("institutions").deleteOne({ institution_id: pair.legacy });
        console.log(`  - institutions: Purged legacy node (${delResult.deletedCount}).`);
    }

    console.log("\n=== STANDARDIZATION COMPLETE ===");

  } finally {
    await client.close();
  }
}

main().catch(console.error);
