require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch1() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 1 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Mahatma Gandhi Government College.*Mayabunder/i },
            update: {
                officialUrl: "http://mggcm.and.nic.in",
                tuition: "₹2,061 (Total UG)",
                acceptedExams: ["CUET UG", "12th Merit"]
            }
        },
        {
            query: { name: /Andaman College.*Port Blair/i },
            update: {
                officialUrl: "http://ancol.andaman.gov.in",
                acceptedExams: ["12th Merit"]
            }
        },
        {
            query: { name: /Government Polytechnic.*Diglipur/i },
            update: {
                officialUrl: "http://collegeadmission.andaman.gov.in",
                acceptedExams: ["10th Merit"]
            }
        },
        {
            query: { name: /Govt. College, Barsar/i },
            update: {
                officialUrl: "https://gcbarsar.ac.in",
                tuition: "₹2,000 - ₹11,000 (Annual Range)",
                acceptedExams: ["12th Merit"]
            }
        },
        {
            query: { name: /Directorate of Forensic Science.*Gujarat/i },
            update: {
                officialUrl: "https://nfsu.ac.in",
                tuition: "₹1.26 Lakh (Total PhD)",
                acceptedExams: ["NFAT", "GATE"]
            }
        },
        {
            query: { name: /Govt. Medical College.*Amritsar/i },
            update: {
                officialUrl: "http://www.gmc.edu.in",
                "placements.averagePackage": "10.00 LPA",
                tuition: "₹8.23 Lakh - ₹9.98 Lakh (Total MBBS)",
                acceptedExams: ["NEET UG", "NEET PG"]
            }
        },
        {
            query: { name: /ITM Trusts Institute of Hotel Management/i },
            update: {
                officialUrl: "https://itm.ac.in",
                "placements.averagePackage": "8.65 LPA",
                tuition: "₹6.90 Lakh (Total B.Sc)",
                acceptedExams: ["ITM Entrance", "Merit Based"]
            }
        },
        {
            query: { name: /SCHOOL OF PLANNING AND ARCHTECTURE.*Telangana/i },
            update: {
                officialUrl: "http://www.jnafau.ac.in",
                "placements.averagePackage": "4.20 LPA",
                tuition: "₹1.75 Lakh (Total B.Arch)",
                acceptedExams: ["NATA", "JEE Main Paper 2", "TS EAMCET"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 1 Complete ---");
    process.exit(0);
}

updateWave4Batch1().catch(err => {
    console.error(err);
    process.exit(1);
});
