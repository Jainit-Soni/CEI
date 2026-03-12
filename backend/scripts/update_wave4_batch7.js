require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch7() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 7 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Gandhi Institute of Science and Technology.*Rayagada/i },
            update: {
                officialUrl: "http://www.gistrayagada.ac.in",
                "placements.averagePackage": "3.50 LPA",
                tuition: "₹46,000 (Total B.Tech)",
                acceptedExams: ["JEE Main"]
            }
        },
        {
            query: { name: /Government Polytechnic.*Sonepur/i },
            update: {
                officialUrl: "http://govtpolysonepur.org",
                "placements.averagePackage": "2.25 LPA",
                tuition: "₹5,900 (Annual Gen)"
            }
        },
        {
            query: { name: /Government Homeopathic Medical College and Hospital Bhopal/i },
            update: {
                officialUrl: "https://www.ghmcbhopalayush.in",
                tuition: "₹35,000 (Annual BHMS)",
                acceptedExams: ["NEET UG", "AIAPGET"]
            }
        },
        {
            query: { name: /Shree N.M. Gopani Polytechnic Institute/i },
            update: {
                officialUrl: "http://www.nmgp.co.in",
                tuition: "₹1.35 Lakh (Total Diploma)"
            }
        },
        {
            query: { name: /B.S. PATEL POLYTECHNIC/i },
            update: {
                officialUrl: "https://guni.ac.in",
                "placements.averagePackage": "4.00 LPA",
                tuition: "₹1.95 Lakh (Total Diploma)"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 7 Complete ---");
    process.exit(0);
}

updateWave4Batch7().catch(err => {
    console.error(err);
    process.exit(1);
});
