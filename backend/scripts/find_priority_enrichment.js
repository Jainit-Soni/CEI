require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function findPriority() {
    await connectDB();
    
    // Priority: Tier 1/2/3 that are missing Average Package but have a name and state.
    const priority = await College.find({
        rankingTier: { $in: ["Tier 1", "Tier 2", "Tier 3"] },
        "placements.averagePackage": "Not Available"
    }).limit(20).select('name location state').lean();

    console.log(JSON.stringify(priority, null, 2));
    process.exit(0);
}

findPriority().catch(err => {
    console.error(err);
    process.exit(1);
});
