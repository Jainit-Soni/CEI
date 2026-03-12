require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch13() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 13 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Arun Joshi Education College/i },
            update: {
                officialUrl: "http://ajce.org.in",
                tuition: "₹39,856 (Total B.Ed)"
            }
        },
        {
            query: { name: /K. Ramesh Thavad Physical Education College/i },
            update: {
                officialUrl: "http://rtmnu.ac.in", // No specific site found, pointing to university as fallback or info page
                "placements.averagePackage": "3.00 LPA"
            }
        },
        {
            query: { name: /Physical Education College.*Aheri/i },
            update: {
                officialUrl: "http://sscbpedcollege.in"
            }
        },
        {
            query: { name: /Adarsh Sanskar College of Education/i },
            update: {
                officialUrl: "http://rvkss.in",
                tuition: "₹31,160 (B.Ed)"
            }
        },
        {
            query: { name: /Annasaheb Gundawar College/i },
            update: {
                officialUrl: "http://www.gundewarcollege.com",
                "placements.averagePackage": "3.00 LPA",
                tuition: "₹55,810 - ₹1.26 Lakh (Range)"
            }
        },
        {
            query: { name: /Bela College.*Bela/i },
            update: {
                officialUrl: "http://rtmnu.ac.in"
            }
        },
        {
            query: { name: /Acharya Vinoba Bhave Arts Commerce Science College.*Ballarpur/i },
            update: {
                officialUrl: "http://unigug.ac.in"
            }
        },
        {
            query: { name: /Raje Dharmarao Law College/i },
            update: {
                officialUrl: "http://unigug.ac.in"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 13 Complete ---");
    process.exit(0);
}

updateWave4Batch13().catch(err => {
    console.error(err);
    process.exit(1);
});
