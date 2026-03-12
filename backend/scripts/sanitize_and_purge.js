require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function sanitizeAndPurge() {
    await connectDB();
    
    console.log("--- 🧹 CEI Data Sanitization & Purge (Option B) ---");
    
    // 1. SELECTIVE PURGE (Option B: Truly Dead Records)
    // Heuristic: No Tech Data AND No Logo AND Not Premium
    const purgeQuery = {
        $and: [
            { isPremium: { $ne: true } },
            { $or: [{ logo: null }, { logo: "" }] },
            { $or: [{ officialUrl: null }, { officialUrl: "" }, { officialUrl: "N/A" }, { officialUrl: "NA" }, { officialUrl: "0" }] },
            { $or: [{ acceptedExams: null }, { acceptedExams: { $size: 0 } }] },
            { $or: [{ "placements.averagePackage": null }, { "placements.averagePackage": "" }, { "placements.averagePackage": "0" }] },
            { $or: [{ tuition: null }, { tuition: "" }, { tuition: "0" }] },
            { $or: [{ overview: null }, { overview: "" }, { overview: "N/A" }] }
        ]
    };

    const countToPurge = await College.countDocuments(purgeQuery);
    console.log(`\nFound ${countToPurge} "Truly Dead" records for deletion.`);
    
    const purgeResult = await College.deleteMany(purgeQuery);
    console.log(`Successfully purged ${purgeResult.deletedCount} records.`);

    // 2. GLOBAL SANITIZATION (Placeholder -> "Not Available")
    console.log("\nStarting Global Sanitization of remaining records...");
    
    const placeholders = [null, "", "0", "0.0", "NA", "N/A", "TBD", "null", "undefined", "http://", "https://"];
    const targetValue = "Not Available";

    // Batch update fields
    // officialUrl
    const urlResult = await College.updateMany(
        { officialUrl: { $in: placeholders } },
        { $set: { officialUrl: targetValue } }
    );
    console.log(`Updated officialUrl in ${urlResult.modifiedCount} records.`);

    // placements.averagePackage
    const pkgResult = await College.updateMany(
        { "placements.averagePackage": { $in: placeholders } },
        { $set: { "placements.averagePackage": targetValue } }
    );
    console.log(`Updated averagePackage in ${pkgResult.modifiedCount} records.`);

    // tuition
    const tuitionResult = await College.updateMany(
        { tuition: { $in: placeholders } },
        { $set: { tuition: targetValue } }
    );
    console.log(`Updated tuition in ${tuitionResult.modifiedCount} records.`);

    // overview
    const overviewResult = await College.updateMany(
        { overview: { $in: placeholders } },
        { $set: { overview: targetValue } }
    );
    console.log(`Updated overview in ${overviewResult.modifiedCount} records.`);

    // meta.establishedYear
    const yearResult = await College.updateMany(
        { "meta.establishedYear": { $in: placeholders } },
        { $set: { "meta.establishedYear": targetValue } }
    );
    console.log(`Updated establishedYear in ${yearResult.modifiedCount} records.`);

    console.log("\n--- ✅ Sanitization & Purge Complete ---");
    process.exit(0);
}

sanitizeAndPurge().catch(err => {
    console.error(err);
    process.exit(1);
});
