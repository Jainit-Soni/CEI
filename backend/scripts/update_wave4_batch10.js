require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch10() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 10 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Aditya Institute of Technology and Management/i },
            update: {
                officialUrl: "http://adityatekkali.edu.in",
                "placements.averagePackage": "3.53 LPA",
                tuition: "₹3.18 Lakh (Total B.Tech)",
                acceptedExams: ["AP EAMCET"]
            }
        },
        {
            query: { name: /Srinivasa Institute of Technology and Management Studies/i },
            update: {
                officialUrl: "http://www.sitams.org",
                "placements.averagePackage": "3.40 LPA",
                tuition: "₹1.72 Lakh (Total B.Tech)",
                acceptedExams: ["AP EAMCET"]
            }
        },
        {
            query: { name: /Amrita Sai Institute of Science and Technology/i },
            update: {
                officialUrl: "http://amritasai.org.in",
                "placements.averagePackage": "3.50 LPA",
                tuition: "₹2.12 Lakh (Total B.Tech)",
                acceptedExams: ["AP EAMCET", "JEE Main"]
            }
        },
        {
            query: { name: /Lakireddy Bali Reddy College of Engineering/i },
            update: {
                officialUrl: "http://lbrce.ac.in",
                "placements.averagePackage": "5.50 LPA",
                tuition: "₹2.0 Lakh - ₹9.43 Lakh (Total B.Tech)",
                acceptedExams: ["AP EAMCET"]
            }
        },
        {
            query: { name: /Ramachandra College of Engineering/i },
            update: {
                officialUrl: "http://rcee.ac.in",
                "placements.averagePackage": "3.50 LPA",
                tuition: "₹2.41 Lakh (Total B.Tech)",
                acceptedExams: ["AP EAMCET"]
            }
        },
        {
            query: { name: /Pydah College of Engineering and Technology/i },
            update: {
                officialUrl: "http://www.pydah.org",
                "placements.averagePackage": "3.50 LPA",
                tuition: "₹50,000 - ₹1.3 Lakh (Total)",
                acceptedExams: ["AP EAMCET"]
            }
        },
        {
            query: { name: /Vikas College of Engineering and Technology/i },
            update: {
                officialUrl: "http://vikasinstitutionsnunna.org",
                "placements.averagePackage": "4.50 LPA",
                tuition: "₹2.36 Lakh (Total B.Tech)",
                acceptedExams: ["AP EAMCET"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 10 Complete ---");
    process.exit(0);
}

updateWave4Batch10().catch(err => {
    console.error(err);
    process.exit(1);
});
