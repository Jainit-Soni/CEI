require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch4() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 4 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Om Insti. Of Eng. & Technology Junagadh/i },
            update: {
                officialUrl: "http://www.omeducation.edu.in",
                "placements.averagePackage": "3.00 LPA",
                tuition: "₹2.94 Lakh (Total BE)",
                acceptedExams: ["GUJCET", "JEE Main"]
            }
        },
        {
            query: { name: /College of Basic Science & Humanities Bhubaneswar/i },
            update: {
                officialUrl: "http://ouat.nic.in/collegeofbasicscience",
                "placements.averagePackage": "3.00 LPA",
                tuition: "₹62,950 (Total B.Sc Range)",
                acceptedExams: ["SSB CPET", "OUAT Entrance"]
            }
        },
        {
            query: { name: /Pt. Lalit Mohan Sharma Government Post Graduate College Rishikesh/i },
            update: {
                officialUrl: "http://www.gpgcrishikesh.org",
                tuition: "₹9,000 - ₹30,000 (Total UG)",
                acceptedExams: ["CUET UG", "12th Merit"]
            }
        },
        {
            query: { name: /St. Lawrence College of Higher Education Delhi/i },
            update: {
                officialUrl: "http://www.stlawrence.in",
                tuition: "₹1.95 Lakh (Total B.Ed)",
                acceptedExams: ["IPU CET"]
            }
        },
        {
            query: { name: /PT. J.N.M. MEDICAL COLLEGE RAIPUR/i },
            update: {
                officialUrl: "http://www.ptjnmcraipur.in",
                "placements.averagePackage": "6.00 LPA",
                tuition: "₹2.3 Lakh - ₹2.5 Lakh (Total MBBS)",
                acceptedExams: ["NEET UG", "NEET PG", "NEET SS"]
            }
        },
        {
            query: { name: /Kishinchand Chellaram College/i },
            update: {
                officialUrl: "https://www.kccollege.edu.in",
                "placements.averagePackage": "4.20 LPA",
                tuition: "₹24,965 - ₹1.20 Lakh (UG Range)",
                acceptedExams: ["12th Merit"]
            }
        },
        {
            query: { name: /The Institute of Science Mumbai/i },
            update: {
                officialUrl: "https://iscm.ac.in",
                "placements.averagePackage": "3.30 LPA",
                tuition: "₹22,215 - ₹80,365 (Total Range)",
                acceptedExams: ["Merit Based"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 4 Complete ---");
    process.exit(0);
}

updateWave4Batch4().catch(err => {
    console.error(err);
    process.exit(1);
});
