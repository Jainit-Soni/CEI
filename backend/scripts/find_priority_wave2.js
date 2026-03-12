require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function findPriorityWave2() {
    await connectDB();
    
    // Priority: Tier 1/2/3 that are missing Average Package but have a name and state.
    // Excluding those we already updated in Wave 1.
    const priority = await College.find({
        rankingTier: { $in: ["Tier 1", "Tier 2", "Tier 3"] },
        "placements.averagePackage": "Not Available",
        name: { $nin: [
            "Dr. Akhilesh Das Gupta Institute of Technology & Management",
            "SAL Institute of Technology and Engineering Research",
            "S.P.MEMORIAL INSTITUTE OF TECHNOLOGY,KAUSHAMBI",
            "MB MORE FOUNDATION OF ARTS COMMERCE SCIENCE WOMEN COLLEGE, RAIGAD",
            "Christian School of Health Science",
            "A N TT College, Sikar"
        ]}
    }).limit(50).select('name location state').lean();

    console.log(JSON.stringify(priority, null, 2));
    process.exit(0);
}

findPriorityWave2().catch(err => {
    console.error(err);
    process.exit(1);
});
