require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch8() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 8 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /St. Peter's Engineering College/i },
            update: {
                officialUrl: "http://www.spechyd.ac.in",
                "placements.averagePackage": "4.50 LPA",
                tuition: "₹3.0 Lakhs - ₹3.84 Lakhs (Total B.Tech)",
                acceptedExams: ["TS EAMCET", "JEE Main"]
            }
        },
        {
            query: { name: /Siddhartha Institute of Technology and Sciences/i },
            update: {
                officialUrl: "http://siddhartha.org.in",
                "placements.averagePackage": "6.00 LPA",
                tuition: "₹54,000 (Annual B.Tech)",
                acceptedExams: ["TS EAMCET", "JEE Main"]
            }
        },
        {
            query: { name: /Abhinav Hi-Tech College of Engineering/i },
            update: {
                officialUrl: "http://www.htec.ac.in",
                "placements.averagePackage": "3.50 LPA",
                tuition: "₹1.88 Lakh (Total B.Tech)",
                acceptedExams: ["TS EAMCET", "JEE Main"]
            }
        },
        {
            query: { name: /Anurag College of Engineering/i },
            update: {
                officialUrl: "http://anurag.edu.in",
                "placements.averagePackage": "6.30 LPA",
                tuition: "₹1.60 Lakh (Annual B.Tech)",
                acceptedExams: ["TS EAMCET", "AnuragCET"]
            }
        },
        {
            query: { name: /Bijnor Institute of Technology/i },
            update: {
                officialUrl: "http://www.rvit.ac.in",
                "placements.averagePackage": "4.50 LPA",
                tuition: "₹2.45 Lakh - ₹3.25 Lakh (Total B.Tech)",
                acceptedExams: ["JEE Main", "UPTAC"]
            }
        },
        {
            query: { name: /Bharat Institute of Technology.*Meerut/i },
            update: {
                officialUrl: "http://bitmeerut.edu.in",
                "placements.averagePackage": "4.25 LPA",
                tuition: "₹3.20 Lakh (Total B.Tech)",
                acceptedExams: ["UPTAC", "JEE Main"]
            }
        },
        {
            query: { name: /Bansal Institute of Engineering and Technology/i },
            update: {
                officialUrl: "https://bansaliet.in",
                "placements.averagePackage": "3.50 LPA",
                tuition: "₹3.80 Lakh (Total B.Tech)",
                acceptedExams: ["JEE Main", "UPTAC"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 8 Complete ---");
    process.exit(0);
}

updateWave4Batch8().catch(err => {
    console.error(err);
    process.exit(1);
});
