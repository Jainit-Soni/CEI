require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave1() {
    await connectDB();
    
    console.log("--- 🚀 Wave 1 Data Enrichment Update ---");
    
    const enrichData = [
        {
            query: { name: /Akhilesh Das Gupta/i },
            update: {
                officialUrl: "https://adgips.ac.in",
                "placements.averagePackage": "5.1 LPA",
                tuition: "₹1,78,000 (1st Year)",
                acceptedExams: ["JEE Main", "IPU CET", "CAT", "CMAT", "CLAT", "CUET"]
            }
        },
        {
            query: { name: /SAL Institute of Technology/i },
            update: {
                officialUrl: "https://siter.ac.in",
                "placements.averagePackage": "2.98 LPA",
                tuition: "₹61,700 (1st Year)",
                acceptedExams: ["GUJCET", "JEE Main", "ACPC"]
            }
        },
        {
            query: { name: /S.P.MEMORIAL INSTITUTE OF TECHNOLOGY/i },
            update: {
                officialUrl: "http://www.spmit.edu.in",
                "placements.averagePackage": "2.5 LPA",
                tuition: "₹55,000 (Annual)",
                acceptedExams: ["JEE Main", "UPTAC", "JEECUP", "CUET-PG"]
            }
        },
        {
            query: { name: /MB MORE FOUNDATION/i },
            update: {
                officialUrl: "http://mbmwomencollege.in",
                tuition: "₹12,000 (Annual Avg)",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /Christian School of Health Science/i },
            update: {
                officialUrl: "https://shuats.edu.in",
                tuition: "₹60,000 (Annual Avg)",
                acceptedExams: ["SHUATS Entrance"]
            }
        },
        {
            query: { name: /A N TT College/i },
            update: {
                tuition: "₹27,000 (Approx)",
                acceptedExams: ["PTET"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 1 Update Complete ---");
    process.exit(0);
}

updateWave1().catch(err => {
    console.error(err);
    process.exit(1);
});
