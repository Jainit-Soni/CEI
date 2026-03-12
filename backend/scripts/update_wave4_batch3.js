require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch3() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 3 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Acharya Shri Nanesh Samta Mahavidyalaya/i },
            update: {
                officialUrl: "http://www.asnsvt.org",
                tuition: "₹31,250 - ₹2.10 Lakh (Total Range)",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /MNR College of Pharmacy/i },
            update: {
                officialUrl: "http://mnrindia.org",
                "placements.averagePackage": "3.60 LPA",
                tuition: "₹2.20 Lakh - ₹5.10 Lakh (Range)",
                acceptedExams: ["TG EAPCET", "GPAT", "TS PGECET"]
            }
        },
        {
            query: { name: /St. Francis College for Women/i },
            update: {
                officialUrl: "https://www.sfc.ac.in",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /Shanti Devi Law College/i },
            update: {
                officialUrl: "http://www.ssdlcrewari.com",
                tuition: "₹1.05 Lakh - ₹1.75 Lakh (Total Professional)",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /SADASUKH COLLEGE OF EDUCATION/i },
            update: {
                officialUrl: "http://www.ssckanina.com",
                acceptedExams: ["12th Merit"]
            }
        },
        {
            query: { name: /Shri Baba Mast Nath Institute of Management/i },
            update: {
                officialUrl: "http://www.sbmimsar.com",
                "placements.averagePackage": "6.00 LPA",
                tuition: "₹80,000 (Total MBA)",
                acceptedExams: ["Merit Based"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 3 Complete ---");
    process.exit(0);
}

updateWave4Batch3().catch(err => {
    console.error(err);
    process.exit(1);
});
