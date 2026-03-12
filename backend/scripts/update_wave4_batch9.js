require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch9() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 9 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Hindustan Institute of Technology.*Management.*Agra/i },
            update: {
                officialUrl: "http://hitm.edu.in",
                "placements.averagePackage": "4.50 LPA",
                tuition: "₹82,000 (Annual B.E/MBA)",
                acceptedExams: ["UPTAC", "UPSEE"]
            }
        },
        {
            query: { name: /Kailash Institute of Pharmacy and Management/i },
            update: {
                officialUrl: "http://kipm.edu.in",
                "placements.averagePackage": "3.25 LPA",
                tuition: "₹3.21 Lakh (Total B.Pharm)",
                acceptedExams: ["CUET-UG", "JEECUP"]
            }
        },
        {
            query: { name: /M.G.M's College of Engineering.*Nanded/i },
            update: {
                officialUrl: "http://mgmcen.ac.in",
                "placements.averagePackage": "5.00 LPA",
                tuition: "₹4.84 Lakh (Total BE)",
                acceptedExams: ["MHT CET", "JEE Main"]
            }
        },
        {
            query: { name: /Siddhartha Institute of Technology and Sciences.*Ghatkesar/i },
            update: {
                officialUrl: "http://siddhartha.org.in",
                "placements.averagePackage": "5.00 LPA",
                tuition: "₹1.89 - ₹3.20 Lakh (Total B.Tech)",
                acceptedExams: ["TS EAPCET"]
            }
        },
        {
            query: { name: /Sree Narayana Institute of Technology.*Kollam/i },
            update: {
                officialUrl: "http://snit.edu.in",
                "placements.averagePackage": "9.50 LPA",
                tuition: "₹4.50 Lakh (Total B.Tech)"
            }
        },
        {
            query: { name: /Maharishi Dayanand University.*Rohtak/i },
            update: {
                officialUrl: "http://mdu.ac.in",
                "placements.averagePackage": "8.70 LPA",
                tuition: "₹2.20 Lakh (Annual B.Tech)"
            }
        },
        {
            query: { name: /Chaudhary Ranbir Singh University/i },
            update: {
                officialUrl: "http://crsu.ac.in",
                "placements.averagePackage": "4.00 LPA",
                tuition: "₹3.15 Lakh (Total B.Tech)"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 9 Complete ---");
    process.exit(0);
}

updateWave4Batch9().catch(err => {
    console.error(err);
    process.exit(1);
});
