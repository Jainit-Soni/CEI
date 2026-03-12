require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function checkPlaceholders() {
    await connectDB();
    
    console.log("--- 🕵️ Placeholder & Sparsity Audit (Deep Dive) ---");
    
    // Find common fake placeholders
    const fakePackages = await College.find({ "placements.averagePackage": { $in: ["0", "N/A", "NA", "TBD", "0.0", "null"] } }).limit(5).lean();
    const fakeUrls = await College.find({ officialUrl: { $in: ["N/A", "NA", "0", "http://", "https://"] } }).limit(5).lean();
    
    console.log("\nSample Fake Packages:");
    fakePackages.forEach(c => console.log(`- ${c.name}: [${c.placements.averagePackage}]`));
    
    console.log("\nSample Fake URLs:");
    fakeUrls.forEach(c => console.log(`- ${c.name}: [${c.officialUrl}]`));

    // Heuristic for "Truly Dead" (Bottom 30% of the 14k)
    // We'll look for records that lack even a state or have 'undefined' in location/name
    const trulyDead = await College.countDocuments({
        $and: [
            { $or: [{ officialUrl: null }, { officialUrl: "" }, { officialUrl: "N/A" }] },
            { $or: [{ acceptedExams: null }, { acceptedExams: { $size: 0 } }] },
            { $or: [{ "placements.averagePackage": null }, { "placements.averagePackage": "" }, { "placements.averagePackage": "0" }] },
            { $or: [
                { location: /undefined/i },
                { name: /undefined/i },
                { state: null },
                { state: "" }
            ]}
        ]
    });
    
    console.log(`\nHeuristic - Truly Dead (No Technical Data + Undefined Metadata): ${trulyDead}`);
    
    process.exit(0);
}

checkPlaceholders().catch(err => {
    console.error(err);
    process.exit(1);
});
