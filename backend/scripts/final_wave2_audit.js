require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function finalWave2Audit() {
    await connectDB();
    
    const stats = await College.aggregate([
        {
            $group: {
                _id: null,
                missingPkg: { $sum: { $cond: [{ $eq: ["$placements.averagePackage", "Not Available"] }, 1, 0] } },
                missingUrl: { $sum: { $cond: [{ $eq: ["$officialUrl", "Not Available"] }, 1, 0] } },
                missingFee: { $sum: { $cond: [{ $eq: ["$tuition", "Not Available"] }, 1, 0] } },
                total: { $sum: 1 }
            }
        }
    ]);

    console.log("FINAL_WAVE2_STATS:" + JSON.stringify(stats[0]));
    process.exit(0);
}

finalWave2Audit().catch(err => {
    console.error(err);
    process.exit(1);
});
