require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave2Cluster3() {
    await connectDB();
    
    console.log("--- 🚀 Wave 2 Cluster 3 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Malwa Institute of Technology/i },
            update: {
                officialUrl: "https://mitindore.co.in",
                "placements.averagePackage": "4.5 LPA",
                tuition: "₹64,200 (1st Year)",
                acceptedExams: ["JEE Main", "GATE", "CAT", "MAT", "CMAT"]
            }
        },
        {
            query: { name: /Bansal College of Engineering|Bansal.*Bhopal/i },
            update: {
                officialUrl: "https://bce.ac.in",
                "placements.averagePackage": "4.5 LPA",
                tuition: "₹80,000 (Annual Avg)",
                acceptedExams: ["JEE Main", "MP BE"]
            }
        },
        {
            query: { name: /Mahakal Institute of Technology/i },
            update: {
                officialUrl: "http://www.mitujjain.ac.in",
                "placements.averagePackage": "3.5 LPA",
                tuition: "₹62,000 - ₹1,10,000 (Annual)",
                acceptedExams: ["JEE Main", "GATE", "CMAT"]
            }
        },
        {
            query: { name: /Ujjain Engineering College/i },
            update: {
                officialUrl: "https://www.uecu.ac.in",
                "placements.averagePackage": "4.2 LPA",
                tuition: "₹22,300 (1st Year)",
                acceptedExams: ["JEE Main", "GATE"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 2 Cluster 3 Complete ---");
    process.exit(0);
}

updateWave2Cluster3().catch(err => {
    console.error(err);
    process.exit(1);
});
