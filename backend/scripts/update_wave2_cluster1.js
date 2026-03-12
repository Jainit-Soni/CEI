require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave2Cluster1() {
    await connectDB();
    
    console.log("--- 🚀 Wave 2 Cluster 1 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /VNS Campus Bhopal|VNS Group of Institutions/i },
            update: {
                officialUrl: "https://vns.ac.in",
                "placements.averagePackage": "4.6 LPA",
                tuition: "₹60,000 - ₹1,50,000 (Annual)",
                acceptedExams: ["JEE Main", "CMAT", "GATE", "GPAT"]
            }
        },
        {
            query: { name: /Indore Institute of Management and Research/i },
            update: {
                officialUrl: "https://indoreinstitute.com/iimr/",
                "placements.averagePackage": "5.68 LPA",
                tuition: "₹1,26,000 (Average)",
                acceptedExams: ["CMAT", "Merit Based"]
            }
        },
        {
            query: { name: /Charak Institute of Pharmacy/i },
            update: {
                officialUrl: "http://www.charakmdl.com/",
                tuition: "₹47,100 (Annual)",
                acceptedExams: ["MHT-CET", "JEE", "GPAT"]
            }
        },
        {
            query: { name: /Shyam Manohar Degree College/i },
            update: {
                officialUrl: "http://smdcbbk.in/",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /Dhenkanal Autonomous College/i },
            update: {
                "placements.averagePackage": "3.5 LPA",
                tuition: "₹10,702 - ₹98,020 (Total)",
                acceptedExams: ["SAMS Odisha"]
            }
        },
        {
            query: { name: /Hallappa Kote College of Education/i },
            update: {
                officialUrl: "http://www.hkbedcollegebidar.com",
                tuition: "₹25,000 (2 Year Total)",
                acceptedExams: ["Merit Based"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 2 Cluster 1 Complete ---");
    process.exit(0);
}

updateWave2Cluster1().catch(err => {
    console.error(err);
    process.exit(1);
});
