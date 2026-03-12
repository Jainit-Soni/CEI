require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch6() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 6 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Rishi Bankim Chandra College/i },
            update: {
                officialUrl: "http://www.rbccollege.ac.in",
                tuition: "₹16,230 (Total BA Hons)",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /Srinivasa Institute of Technology and Science/i },
            update: {
                officialUrl: "http://www.sitskadapa.ac.in",
                "placements.averagePackage": "4.25 LPA",
                tuition: "₹1.89 Lakh (Total B.Tech)",
                acceptedExams: ["AP EAPCET", "AP ECET", "AP PGECET"]
            }
        },
        {
            query: { name: /Government Polytechnic.*Vikramgad/i },
            update: {
                officialUrl: "http://gpvikramgad.ac.in",
                "placements.averagePackage": "3.50 LPA",
                tuition: "₹18,000 (Total Diploma)"
            }
        },
        {
            query: { name: /Government Polytechnic.*Panaji/i },
            update: {
                officialUrl: "https://www.gpp.goa.gov.in",
                tuition: "₹18,600 (Annual Diploma)"
            }
        },
        {
            query: { name: /Shri Vile Parle Kelavani Mandal's Institute of Technology.*Dhule/i },
            update: {
                officialUrl: "http://svkm-iot.ac.in",
                "placements.averagePackage": "3.80 LPA",
                tuition: "₹4.38 Lakh (Total B.Tech)"
            }
        },
        {
            query: { name: /Saurashtra University/i },
            update: {
                officialUrl: "http://saurashtrauniversity.ac.in",
                "placements.averagePackage": "3.50 LPA",
                tuition: "₹1.68 Lakh (Total BCA)",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /Veer Narmad South Gujarat University/i },
            update: {
                officialUrl: "http://www.vnsgu.ac.in",
                "placements.averagePackage": "3.00 LPA",
                tuition: "₹10,685 - ₹3.05 Lakh (Range)",
                acceptedExams: ["Merit Based"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 6 Complete ---");
    process.exit(0);
}

updateWave4Batch6().catch(err => {
    console.error(err);
    process.exit(1);
});
