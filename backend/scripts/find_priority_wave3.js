require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');
const fs = require('fs');

async function findPriorityWave3() {
    await connectDB();
    
    // Previous waves updated names (partial list for exclusion)
    const excludeNames = [
        /Dr. Akhilesh Das Gupta/i, /SAL Institute/i, /S.P.MEMORIAL/i, /MB MORE/i,
        /Christian School of Health/i, /A N TT College/i, /Adesh Institute/i,
        /VNS Campus/i, /VNS Group/i, /Indore Institute of Management/i,
        /Charak Institute/i, /Shyam Manohar/i, /Dhenkanal Autonomous/i,
        /Hallappa Kote/i, /Jabalpur Engineering/i, /Government Engineering College.*Jabalpur/i,
        /Sir J. J. College of Architecture/i, /Lakshmi Narain College/i, /LNCT/i,
        /Rustamji Institute/i, /Samrat Ashok/i, /Malwa Institute/i, /Bansal College/i,
        /Mahakal Institute/i, /Ujjain Engineering/i, /Rewa College/i, /Rizvi College/i,
        /IPS Academy.*Pharmacy/i, /Swa.*Pyarelal Kanwar/i
    ];

    const priority = await College.find({
        rankingTier: { $in: ["Tier 1", "Tier 2", "Tier 3"] },
        "placements.averagePackage": "Not Available",
        name: { $nin: excludeNames }
    }).limit(100).select('name location state rankingTier').lean();

    console.log(`Found ${priority.length} priority colleges for Wave 3.`);
    fs.writeFileSync('wave3_targets.json', JSON.stringify(priority, null, 2));
    console.log('Saved to wave3_targets.json');
    process.exit(0);
}

findPriorityWave3().catch(err => {
    console.error(err);
    process.exit(1);
});
