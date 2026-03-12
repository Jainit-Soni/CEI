require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch5() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 5 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Santhigiri Siddha Medical College/i },
            update: {
                officialUrl: "http://ssmc.ac.in",
                "placements.averagePackage": "2.80 LPA",
                tuition: "₹1.98 Lakh (Annual BSMS)",
                acceptedExams: ["NEET UG"]
            }
        },
        {
            query: { name: /St. Michael's College.*Cherthala/i },
            update: {
                officialUrl: "http://www.stmcc.in",
                tuition: "₹54,000 - ₹90,000 (UG/PG Range)",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /M.E.S Ponnani College/i },
            update: {
                officialUrl: "http://www.mespni.ac.in",
                "placements.averagePackage": "4.80 LPA",
                tuition: "₹6,125 (Total UG)",
                acceptedExams: ["Calicut CAP", "Merit Based"]
            }
        },
        {
            query: { name: /Government Arts College.*Thiruvananthapuram/i },
            update: {
                officialUrl: "http://www.gactvm.org",
                "placements.averagePackage": "4.00 LPA",
                tuition: "₹54,000 - ₹67,500 (UG Range)",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /Sree Narayana Training College.*Nedunganda/i },
            update: {
                officialUrl: "http://sntrainingcollege.edu.in",
                tuition: "₹7,140 (Total B.Ed)",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /Mahatma Gandhi College.*Thiruvananthapuram/i },
            update: {
                officialUrl: "http://mgcollegetvm.ac.in",
                "placements.averagePackage": "2.25 LPA",
                tuition: "₹54,000 - ₹67,500 (UG Range)",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /Nirmala College.*Muvattupuzha/i },
            update: {
                officialUrl: "http://www.nirmalacollege.ac.in",
                "placements.averagePackage": "3.25 LPA",
                tuition: "₹6,960 - ₹1.26 Lakh (Range)",
                acceptedExams: ["CUET", "KMAT Kerala"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 5 Complete ---");
    process.exit(0);
}

updateWave4Batch5().catch(err => {
    console.error(err);
    process.exit(1);
});
