require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch15() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 15 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Patitapaban Mahavidyalaya.*Angul/i },
            update: {
                tuition: "₹45,000 - ₹49,550 (UG Total)"
            }
        },
        {
            query: { name: /VIKAS DEGREE COLLEGE.*RATHNAPUR/i },
            update: {
                officialUrl: "http://vikasdegreecollege.in",
                tuition: "₹22,230 - ₹36,000 (UG Total)"
            }
        },
        {
            query: { name: /RAJKIYA SNATAKOTTAR MAHAVIDYALAYA.*BAZPUR/i },
            update: {
                officialUrl: "http://gpgcbazpur.com"
            }
        },
        {
            query: { name: /Pt. Lalit Mohan Sharma Government Post Graduate College Rishikesh/i },
            update: {
                officialUrl: "http://gpgcrishikesh.org",
                "placements.averagePackage": "3.00 LPA",
                tuition: "₹900 - ₹35,000 (Annual)"
            }
        },
        {
            query: { name: /Garg U.G. Degree College.*Laksar/i },
            update: {
                officialUrl: "http://gargpgcollege.com"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 15 Complete ---");
    process.exit(0);
}

updateWave4Batch15().catch(err => {
    console.error(err);
    process.exit(1);
});
