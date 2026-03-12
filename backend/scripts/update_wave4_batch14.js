require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch14() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 14 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /United Mission Degree College/i },
            update: {
                officialUrl: "http://umdcblr.org",
                tuition: "₹88,500 - ₹93,750 (UG Total)"
            }
        },
        {
            query: { name: /Govt. First Grade College.*Magadi/i },
            update: {
                officialUrl: "http://gfgc.kar.nic.in/magadi"
            }
        },
        {
            query: { name: /Govt. First Grade College.*Bangarpet/i },
            update: {
                officialUrl: "http://gfgc.kar.nic.in/bangarapet"
            }
        },
        {
            query: { name: /Om Insti. Of Eng.& Technology.*Junagadh/i },
            update: {
                officialUrl: "http://omeducation.edu.in",
                "placements.averagePackage": "4.00 LPA",
                tuition: "₹1.26 Lakh - ₹2.68 Lakh (Total Course)"
            }
        },
        {
            query: { name: /College of Basic Science & Humanities.*Bhubaneswar/i },
            update: {
                officialUrl: "http://ouat.nic.in/collegeofbasicscience",
                "placements.averagePackage": "3.00 LPA",
                tuition: "₹15,000 (Annual Approx)"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 14 Complete ---");
    process.exit(0);
}

updateWave4Batch14().catch(err => {
    console.error(err);
    process.exit(1);
});
