require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave2Cluster2() {
    await connectDB();
    
    console.log("--- 🚀 Wave 2 Cluster 2 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Jabalpur Engineering College|Government Engineering College.*Jabalpur/i },
            update: {
                officialUrl: "http://www.jecjabalpur.ac.in",
                "placements.averagePackage": "5.0 LPA",
                tuition: "₹57,476 - ₹89,200 (Total)",
                acceptedExams: ["JEE Main", "GATE", "MP Pre-MCA"]
            }
        },
        {
            query: { name: /Sir J. J. College of Architecture/i },
            update: {
                officialUrl: "http://www.sirjjarchitecture.org",
                "placements.averagePackage": "8.0 LPA",
                tuition: "₹18,584 (1st Year)",
                acceptedExams: ["NATA", "JEE Main Paper II", "MHT CET"]
            }
        },
        {
            query: { name: /Lakshmi Narain College of Technology.*Bhopal|LNCT.*Bhopal/i },
            update: {
                officialUrl: "https://lnct.ac.in",
                "placements.averagePackage": "5.5 LPA",
                tuition: "₹1,00,000 - ₹1,37,100 (Annual)",
                acceptedExams: ["JEE Main", "LNCT-CET", "GATE"]
            }
        },
        {
            query: { name: /Rustamji Institute of Technology/i },
            update: {
                officialUrl: "http://www.rjit.ac.in",
                "placements.averagePackage": "4.5 LPA",
                tuition: "₹60,000 - ₹3,15,000 (Range)",
                acceptedExams: ["JEE Main", "MP BE", "GATE"]
            }
        },
        {
            query: { name: /Samrat Ashok Technological Institute/i },
            update: {
                officialUrl: "http://www.satiengg.in",
                "placements.averagePackage": "5.16 LPA",
                tuition: "₹87,400 (1st Year)",
                acceptedExams: ["JEE Main", "GATE", "MAT", "CMAT"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 2 Cluster 2 Complete ---");
    process.exit(0);
}

updateWave2Cluster2().catch(err => {
    console.error(err);
    process.exit(1);
});
