require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave3Batch3() {
    await connectDB();
    
    console.log("--- 🚀 Wave 3 Batch 3 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Bhagwant Pandey/i },
            update: {
                officialUrl: "http://www.bpmahavidyalaya.org",
                acceptedExams: ["Merit Based", "College Entrance"]
            }
        },
        {
            query: { name: /Devi Sharan Degree College/i },
            update: {
                officialUrl: "http://devisaraha.com",
                tuition: "₹18,000 (Annual B.Sc)",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /Karma Devi Smriti Mahavidyalaya/i },
            update: {
                officialUrl: "http://www.ksm.ac.in",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /SRI YAGYA NARAYAN PANDEY/i },
            update: {
                officialUrl: "http://www.synpsdc.org",
                tuition: "₹1,20,000 (Total B.A.)",
                acceptedExams: ["12th Merit"]
            }
        },
        {
            query: { name: /NARAYAN MAHAVIDYALAYA, AUNTA/i },
            update: {
                officialUrl: "http://www.narayanmahavidyalaya.co.in",
                acceptedExams: ["12th Merit"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 3 Batch 3 Complete ---");
    process.exit(0);
}

updateWave3Batch3().catch(err => {
    console.error(err);
    process.exit(1);
});
