require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave5Batch7() {
    await connectDB();
    
    console.log("--- 🌍 Wave 5 Batch 7: The Global Sweep (Cluster 7 - Regional Hubs) ---");
    
    const enrichData = [
        {
            query: { name: /Adarsh Degree College/i },
            update: {
                officialUrl: "http://adarshpgcollege.ac.in",
                tuition: "₹12,000 (Annual UG Estimate)"
            }
        },
        {
            query: { name: /Anwar Engineering College/i },
            update: {
                officialUrl: "http://www.anwarululoom.com",
                tuition: "₹1.40 Lakh (Total B.Tech)",
                "placements.averagePackage": "4.26 LPA"
            }
        },
        {
            query: { name: /B.V.V. Sangha's Institute of Management Studies/i },
            update: {
                officialUrl: "http://www.bimsbagalkot.ac.in",
                tuition: "₹1.16 Lakh (Total MBA)",
                "placements.averagePackage": "4.20 LPA",
                "placements.highestPackage": "7.35 LPA"
            }
        },
        {
            query: { name: /Government Degree College.*Medak/i },
            update: {
                tuition: "₹3,000 (Annual UG Estimate)"
            }
        },
        {
            query: { name: /Jai Narayan Vyas University/i },
            update: {
                officialUrl: "http://jnvu.edu.in",
                tuition: "₹1.96 Lakh - ₹2.74 Lakh (Total B.E.)",
                "placements.averagePackage": "7.00 - 12.00 LPA",
                "placements.highestPackage": "16.00 LPA"
            }
        },
        {
            query: { name: /Society's College of Business Administration/i },
            update: {
                officialUrl: "http://klecbahubli.org",
                tuition: "₹1.95 Lakh (Total BBA)",
                "placements.highestPackage": "9.00 LPA"
            }
        },
        {
            query: { name: /Mahatma Gandhi University.*Nalgonda/i },
            update: {
                officialUrl: "http://mguniversity.ac.in",
                tuition: "₹2.29 Lakh (Total B.Tech)",
                "placements.averagePackage": "5.00 LPA",
                "placements.highestPackage": "10.00 LPA"
            }
        },
        {
            query: { name: /Palamuru University/i },
            update: {
                officialUrl: "http://palamuruuniversity.ac.in",
                tuition: "₹41,400 (Total B.Pharm)",
                "placements.averagePackage": "3.50 LPA",
                "placements.highestPackage": "7.00 LPA"
            }
        },
        {
            query: { name: /Dr. K.S. Raju Arts and Science College/i },
            update: {
                officialUrl: "http://svkpandksrajucollege.edu.in",
                tuition: "₹70,000 (Total MBA) / ₹35,000 (Total MCA)",
                "placements.averagePackage": "2.16 LPA"
            }
        },
        {
            query: { name: /Telangana University/i },
            update: {
                officialUrl: "http://www.telanganauniversity.ac.in",
                "placements.averagePackage": "5.00 LPA",
                "placements.highestPackage": "15.00 LPA"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 5 Batch 7 Complete ---");
    process.exit(0);
}

updateWave5Batch7().catch(err => {
    console.error(err);
    process.exit(1);
});
