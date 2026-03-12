require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch18() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 18 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Jai Maa Sudami Devi Balika Mahavidyalaya/i },
            update: {
                officialUrl: "http://jmsdm.org.in",
                tuition: "₹3,500 - ₹21,000 (BA/B.Sc Range)"
            }
        },
        {
            query: { name: /RAJKIYA P.G. COLLEGE.*SANGIPUR/i },
            update: {
                officialUrl: "http://rsmvsangipur.in",
                "placements.averagePackage": "5.40 LPA"
            }
        },
        {
            query: { name: /BHAGWAT DUTT MAHAVIDYALAYA/i },
            update: {
                officialUrl: "http://bdgdcajhara.com"
            }
        },
        {
            query: { name: /RUMA MAHAVIDYALAYA/i },
            update: {
                officialUrl: "http://rims.edu.in" // Deduced from email rims.pbh
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 18 Complete ---");
    process.exit(0);
}

updateWave4Batch18().catch(err => {
    console.error(err);
    process.exit(1);
});
