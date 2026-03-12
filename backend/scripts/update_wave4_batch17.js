require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch17() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 17 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Navjeevan College of Computer Science/i },
            update: {
                officialUrl: "http://navjeevannashik.org",
                "placements.averagePackage": "4.50 LPA", // Parent/Cluster data
                tuition: "₹1.51 Lakh (Parent MBA Approx)"
            }
        },
        {
            query: { name: /Vishwabharati Academy's College of Engineering/i },
            update: {
                officialUrl: "http://www.vacoea.com",
                "placements.averagePackage": "5.50 LPA",
                "placements.highestPackage": "14.00 LPA",
                tuition: "₹2.10 Lakh - ₹5.43 Lakh (Course Range)"
            }
        },
        {
            query: { name: /K.E.M. Hospital and Research Institute/i },
            update: {
                officialUrl: "http://kemhospitalpune.org",
                tuition: "₹1.25 Lakh (Annual DNB)"
            }
        },
        {
            query: { name: /Maharashtra Institute of Engineering Research/i },
            update: {
                officialUrl: "http://merinasik.org" // Government Research Portal
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 17 Complete ---");
    process.exit(0);
}

updateWave4Batch17().catch(err => {
    console.error(err);
    process.exit(1);
});
