require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function granularAudit() {
    await connectDB();
    
    console.log("--- 📊 Granular Data Sparsity Audit ---");
    
    const total = await College.countDocuments();
    console.log(`Current Total Colleges: ${total}`);

    const naValue = "Not Available";

    // 1. Official Site Missing
    const missingSite = await College.countDocuments({
        $or: [
            { officialUrl: naValue },
            { officialUrl: null },
            { officialUrl: "" }
        ]
    });

    // 2. Address (Location) Missing
    const missingAddress = await College.countDocuments({
        $or: [
            { location: naValue },
            { location: null },
            { location: "" }
        ]
    });

    // 3. Cut offs Missing
    const missingCutoffs = await College.countDocuments({
        $or: [
            { pastCutoffs: { $size: 0 } },
            { pastCutoffs: null }
        ]
    });

    // 4. Tuition Fee Missing
    const missingTuition = await College.countDocuments({
        $or: [
            { tuition: naValue },
            { tuition: null },
            { tuition: "" }
        ]
    });

    // 5. Packages Missing
    const missingPackages = await College.countDocuments({
        $or: [
            { "placements.averagePackage": naValue },
            { "placements.averagePackage": null },
            { "placements.averagePackage": "" }
        ]
    });

    console.log("\nIndividual Counts (Records missing this data):");
    console.log(`- Official Site:   ${missingSite}`);
    console.log(`- Address:         ${missingAddress}`);
    console.log(`- Cut offs:        ${missingCutoffs}`);
    console.log(`- Tuition Fee:     ${missingTuition}`);
    console.log(`- Packages (Avg):  ${missingPackages}`);

    console.log("\n--- Audit Complete ---");
    process.exit(0);
}

granularAudit().catch(err => {
    console.error(err);
    process.exit(1);
});
