require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch16() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 16 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Arihant Institute of Management Studies/i },
            update: {
                officialUrl: "http://arihanteducationfoundation.org",
                "placements.averagePackage": "5.50 LPA",
                "placements.highestPackage": "10.00 LPA",
                tuition: "₹1.7 Lakh - ₹1.92 Lakh (Total MBA)",
                acceptedExams: ["MAH-CET", "CAT", "MAT", "CMAT"]
            }
        },
        {
            query: { name: /Mitcon Institute of Management/i },
            update: {
                officialUrl: "https://mima.edu.in",
                "placements.averagePackage": "7.50 LPA",
                "placements.highestPackage": "18.00 LPA",
                tuition: "₹6.7 Lakh - ₹7.65 Lakh (Total PGDM)",
                acceptedExams: ["CAT", "MAT", "XAT", "ATMA", "CMAT", "MAH CET"]
            }
        },
        {
            query: { name: /Vishwakarama Institute of Technology/i },
            update: {
                officialUrl: "http://www.vit.edu",
                "placements.averagePackage": "9.72 LPA",
                "placements.highestPackage": "51.00 LPA",
                tuition: "₹8.45 Lakh (Total 4-year B.Tech)",
                acceptedExams: ["MHT-CET", "JEE Main"]
            }
        },
        {
            query: { name: /P.G.K.M.S. Institute of Management/i },
            update: {
                officialUrl: "http://pgkmschool.org" // Note: Research indicates this is primarily a school (PGKM School)
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 16 Complete ---");
    process.exit(0);
}

updateWave4Batch16().catch(err => {
    console.error(err);
    process.exit(1);
});
