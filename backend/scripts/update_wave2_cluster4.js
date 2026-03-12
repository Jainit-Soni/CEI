require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave2Cluster4() {
    await connectDB();
    
    console.log("--- 🚀 Wave 2 Cluster 4 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Rewa College of Pharmacy/i },
            update: {
                officialUrl: "http://rcprewa.in",
                "placements.averagePackage": "2.0 LPA",
                tuition: "₹53,000 (Annual)",
                acceptedExams: ["Merit Based", "GPAT"]
            }
        },
        {
            query: { name: /Rizvi College of Architecture/i },
            update: {
                officialUrl: "http://www.rizviarchitecture.edu.in",
                "placements.averagePackage": "6.2 LPA",
                tuition: "₹1,21,000 (Annual Avg)",
                acceptedExams: ["NATA", "JEE Main Paper 2", "MAH M.Arch CET"]
            }
        },
        {
            query: { name: /IPS Academy.*Pharmacy/i },
            update: {
                "placements.averagePackage": "6.0 LPA",
                tuition: "₹99,200 (1st Year)",
                acceptedExams: ["12th Merit", "GPAT"]
            }
        },
        {
            query: { name: /Swa.*Pyarelal Kanwar.*Govt College/i },
            update: {
                officialUrl: "http://gcbkorba.ac.in",
                acceptedExams: ["Merit Based"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 2 Cluster 4 Complete ---");
    process.exit(0);
}

updateWave2Cluster4().catch(err => {
    console.error(err);
    process.exit(1);
});
