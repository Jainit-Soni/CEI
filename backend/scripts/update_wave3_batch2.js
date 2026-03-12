require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave3Batch2() {
    await connectDB();
    
    console.log("--- 🚀 Wave 3 Batch 2 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Manav Institute of Education/i },
            update: {
                officialUrl: "http://manavinstitute.com",
                "placements.averagePackage": "5.00 LPA",
                tuition: "₹88,000 (Total B.Ed)",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /Laxmi Narayan Degree College.*Pipilia/i },
            update: {
                officialUrl: "http://lndcollegepipilia.org",
                tuition: "₹19,860 (Total B.A. Odia)",
                acceptedExams: ["SAMS Odisha"]
            }
        },
        {
            query: { name: /A.P College, Raruan/i },
            update: {
                officialUrl: "http://apcollege.online",
                tuition: "₹21,140 (Total B.A.)",
                acceptedExams: ["12th Merit"]
            }
        },
        {
            query: { name: /Warana Mahavidyalaya, AITAWADE/i },
            update: {
                officialUrl: "http://ycwm.ac.in",
                tuition: "₹10,000 (Total B.A.)",
                acceptedExams: ["Merit Based"]
            }
        },
        {
            query: { name: /BHM First Grade College, Besagarahalli/i },
            update: {
                officialUrl: "http://www.ghmfg.org",
                tuition: "₹15,000 - ₹18,000 (Annual)",
                acceptedExams: ["12th Merit"]
            }
        },
        {
            query: { name: /Mahadeo Singh College, Bhagalpur/i },
            update: {
                officialUrl: "http://mahadeosinghcollege.org",
                "placements.averagePackage": "2.50 LPA",
                tuition: "₹48,000 - ₹60,000 (Total Prof.)",
                acceptedExams: ["12th Merit", "College Entrance"]
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 3 Batch 2 Complete ---");
    process.exit(0);
}

updateWave3Batch2().catch(err => {
    console.error(err);
    process.exit(1);
});
