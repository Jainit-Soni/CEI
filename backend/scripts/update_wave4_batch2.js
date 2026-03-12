require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch2() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 2 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Rani Birla Girls' College/i },
            update: {
                officialUrl: "http://www.rbgc.in",
                tuition: "₹17,950 - ₹90,500 (Total Range)",
                acceptedExams: ["12th Merit"]
            }
        },
        {
            query: { name: /K.L.S.College/i },
            update: {
                officialUrl: "http://klscollegenawada.org",
                acceptedExams: ["12th Merit"]
            }
        },
        {
            query: { name: /Madhab Choudhury College/i },
            update: {
                officialUrl: "http://mccollege.edu.in",
                "placements.averagePackage": "2.50 LPA",
                tuition: "₹15,000 - ₹90,000 (Course Range)",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /Progati College/i },
            update: {
                officialUrl: "http://www.progaticollege.com",
                acceptedExams: ["12th Merit"]
            }
        },
        {
            query: { name: /ADB First Grade College, Harpanahalli/i },
            update: {
                officialUrl: "http://www.adbcollege.org",
                acceptedExams: ["12th Merit"]
            }
        },
        {
            query: { name: /Vikas Group of Institutions.*Vijayawada/i },
            update: {
                officialUrl: "https://vikasgroup.ac.in",
                "placements.averagePackage": "4.50 LPA",
                tuition: "₹70,000 - ₹2.36 Lakh (Course Range)",
                acceptedExams: ["AP EAMCET", "AP ICET", "GATE", "AP PGECET"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 2 Complete ---");
    process.exit(0);
}

updateWave4Batch2().catch(err => {
    console.error(err);
    process.exit(1);
});
