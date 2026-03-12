require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch12() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 12 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Madhab Choudhury College/i },
            update: {
                officialUrl: "http://mccassam.org",
                "placements.averagePackage": "3.00 LPA",
                tuition: "₹13,270 - ₹44,320 (UG Total)"
            }
        },
        {
            query: { name: /Progati College/i },
            update: {
                officialUrl: "http://progaticollege.org",
                tuition: "₹28,720 (BA Hons)"
            }
        },
        {
            query: { name: /RS College.*Tarapur/i },
            update: {
                officialUrl: "http://rsctarapur.ac.in"
            }
        },
        {
            query: { name: /ADB First Grade College/i },
            update: {
                officialUrl: "http://adbcollege.org"
            }
        },
        {
            query: { name: /Vikas Group of Institutions.*Nunna/i },
            update: {
                officialUrl: "http://vikas.edu.in",
                "placements.averagePackage": "5.50 LPA",
                tuition: "₹2.36 Lakh (Total B.Tech)"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 12 Complete ---");
    process.exit(0);
}

updateWave4Batch12().catch(err => {
    console.error(err);
    process.exit(1);
});
