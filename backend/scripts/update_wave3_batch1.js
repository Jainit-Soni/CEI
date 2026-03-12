require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave3Batch1() {
    await connectDB();
    
    console.log("--- 🚀 Wave 3 Batch 1 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Darshan Institute of Engineering/i },
            update: {
                officialUrl: "https://www.darshan.ac.in",
                "placements.averagePackage": "3.57 LPA",
                tuition: "₹81,667 (Annual)",
                acceptedExams: ["JEE Main", "GUJCET", "GATE"]
            }
        },
        {
            query: { name: /Laxmi Institute of Technology.*Sarigam/i },
            update: {
                officialUrl: "https://lit.laxmi.edu.in",
                "placements.averagePackage": "4.50 LPA",
                tuition: "₹3,15,000 (Total B.Tech)",
                acceptedExams: ["GUJCET", "JEE Main"]
            }
        },
        {
            query: { name: /CK Pithawalla College/i },
            update: {
                officialUrl: "http://www.ckpcet.ac.in",
                "placements.averagePackage": "4.50 LPA",
                tuition: "₹92,400 - ₹3,70,000 (Total)",
                acceptedExams: ["JEE Main", "GUJCET"]
            }
        },
        {
            query: { name: /Adani University/i },
            update: {
                officialUrl: "https://adaniuni.ac.in",
                "placements.averagePackage": "7.50 LPA",
                tuition: "₹3,30,000 (Total MBA)",
                acceptedExams: ["JEE Main", "CAT", "CMAT", "GUJCET"]
            }
        },
        {
            query: { name: /L.D.COLLEGE OF ENGINEERING/i },
            update: {
                officialUrl: "http://www.ldce.ac.in",
                "placements.averagePackage": "5.00 LPA",
                tuition: "₹1,500 (Annual Tuition)",
                acceptedExams: ["GUJCET", "JEE Main", "GATE"]
            }
        },
        {
            query: { name: /Abhinav Education Society College/i },
            update: {
                officialUrl: "http://abhinavengineering.com",
                "placements.averagePackage": "3.00 LPA",
                tuition: "₹70,000 (Annual)",
                acceptedExams: ["MHT CET", "JEE Main"]
            }
        },
        {
            query: { name: /Govt. Law College, Ernakulam/i },
            update: {
                officialUrl: "http://www.glcekm.com",
                "placements.averagePackage": "2.72 LPA",
                tuition: "₹4,725 - ₹7,875 (Annual Range)",
                acceptedExams: ["KLEE"]
            }
        },
        {
            query: { name: /St. Bede's College, Shimla/i },
            update: {
                officialUrl: "http://www.stbedescollege.in",
                "placements.averagePackage": "3.00 LPA",
                tuition: "₹80,704 - ₹2,07,000 (Total UG)",
                acceptedExams: ["12th Merit"]
            }
        },
        {
            query: { name: /Quba College of Engineering/i },
            update: {
                officialUrl: "https://www.qubacollege.in",
                "placements.averagePackage": "4.50 LPA",
                tuition: "₹1,70,000 (Total B.Tech)",
                acceptedExams: ["AP EAMCET", "GATE", "AP ICET"]
            }
        },
        {
            query: { name: /S C T Institute of Technology/i },
            update: {
                "placements.averagePackage": "5.90 LPA",
                tuition: "₹4,50,000 (Total B.Tech)",
                acceptedExams: ["KCET", "COMEDK UGET", "PGCET"]
            }
        },
        {
            query: { name: /Mar Baselios College, Adimaly/i },
            update: {
                officialUrl: "http://www.mbcollegeadimaly.com",
                tuition: "₹1,85,000 - ₹2,00,000 (Annual Avg)",
                acceptedExams: ["Merit Based"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 3 Batch 1 Complete ---");
    process.exit(0);
}

updateWave3Batch1().catch(err => {
    console.error(err);
    process.exit(1);
});
