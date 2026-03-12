require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch20() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 20 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /K.M. COLLEGE OF PHARMACY/i },
            update: {
                officialUrl: "http://www.kmcp.ac.in",
                "placements.averagePackage": "4.20 LPA",
                "placements.highestPackage": "12.00 LPA",
                tuition: "₹77,000 - ₹1.12 Lakh (Total B.Pharm)",
                acceptedExams: ["NEET"]
            }
        },
        {
            query: { name: /SDJ International College/i },
            update: {
                officialUrl: "https://www.sdjic.org",
                "placements.averagePackage": "3.50 LPA",
                "placements.highestPackage": "12.00 LPA",
                tuition: "₹73,000 - ₹82,000 (BBA/BCA Total)"
            }
        },
        {
            query: { name: /Alagappa University Evening College.*Ramanathapuram/i },
            update: {
                officialUrl: "http://alagappauniversity.ac.in",
                tuition: "₹7,500 - ₹16,200 (Course Range)"
            }
        },
        {
            query: { name: /Suvidya Degree College.*Chityal/i },
            update: {
                officialUrl: "https://suvidyadegreecollege.ueniweb.com"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 20 Complete ---");
    process.exit(0);
}

updateWave4Batch20().catch(err => {
    console.error(err);
    process.exit(1);
});
