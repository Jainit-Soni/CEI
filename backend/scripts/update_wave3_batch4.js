require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave3Batch4() {
    await connectDB();
    
    console.log("--- 🚀 Wave 3 Batch 4 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /SVES'S B.PED COLLEGE/i },
            update: {
                officialUrl: "http://www.svesaccharugeri.org"
            }
        },
        {
            query: { name: /Annammal college of Education/i },
            update: {
                officialUrl: "https://annammal.org",
                tuition: "₹43,000 (Total B.Ed)",
                acceptedExams: ["Merit Based", "TNTEU"]
            }
        },
        {
            query: { name: /Kamala College of Education/i },
            update: {
                officialUrl: "http://www.kamalacollege.org",
                acceptedExams: ["Merit Based"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 3 Batch 4 Complete ---");
    process.exit(0);
}

updateWave3Batch4().catch(err => {
    console.error(err);
    process.exit(1);
});
