require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');
const fs = require('fs');

async function findPriorityWave4() {
    await connectDB();
    
    // Comprehensive exclusion list from all previous waves
    const excludeNames = [
        /Dr. Akhilesh Das Gupta/i, /SAL Institute/i, /S.P.MEMORIAL/i, /MB MORE/i,
        /Christian School of Health/i, /A N TT College/i, /Adesh Institute/i,
        /VNS Campus/i, /VNS Group/i, /Indore Institute of Management/i,
        /Charak Institute/i, /Shyam Manohar/i, /Dhenkanal Autonomous/i,
        /Hallappa Kote/i, /Jabalpur Engineering/i, /Government Engineering College.*Jabalpur/i,
        /Sir J. J. College of Architecture/i, /Lakshmi Narain College/i, /LNCT/i,
        /Rustamji Institute/i, /Samrat Ashok/i, /Malwa Institute/i, /Bansal College/i,
        /Mahakal Institute/i, /Ujjain Engineering/i, /Rewa College/i, /Rizvi College/i,
        /IPS Academy.*Pharmacy/i, /Swa.*Pyarelal Kanwar/i,
        /Darshan Institute/i, /Laxmi Institute/i, /CK Pithawalla/i, /Adani University/i,
        /L.D.COLLEGE OF ENGINEERING/i, /Abhinav Education Society/i, /Govt. Law College, Ernakulam/i,
        /St. Bede's College/i, /Quba College/i, /S C T Institute/i, /Mar Baselios College/i,
        /Manav Institute/i, /Laxmi Narayan Degree/i, /A.P College/i, /Warana Mahavidyalaya/i,
        /BHM First Grade/i, /Mahadeo Singh College/i, /Bhagwant Pandey/i, /Devi Sharan Degree/i,
        /Karma Devi Smriti/i, /SRI YAGYA NARAYAN/i, /NARAYAN MAHAVIDYALAYA/i,
        /SVES'S B.PED COLLEGE/i, /Annammal college of Education/i, /Kamala College of Education/i
    ];

    const priority = await College.find({
        rankingTier: { $in: ["Tier 1", "Tier 2", "Tier 3"] },
        "placements.averagePackage": "Not Available",
        name: { $nin: excludeNames }
    }).limit(250).select('name location state rankingTier').lean();

    console.log(`Found ${priority.length} priority colleges for Wave 4.`);
    fs.writeFileSync('wave4_targets.json', JSON.stringify(priority, null, 2));
    console.log('Saved to wave4_targets.json');
    process.exit(0);
}

findPriorityWave4().catch(err => {
    console.error(err);
    process.exit(1);
});
