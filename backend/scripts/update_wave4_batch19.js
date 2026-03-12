require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch19() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 19 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /Indira Gandhi T T College.*Bundi/i },
            update: {
                officialUrl: "http://www.indiragandhittcollege.com",
                tuition: "₹40,000 - ₹60,000 (Edu Range)"
            }
        },
        {
            query: { name: /M N College of Nursing.*Bikaner/i },
            update: {
                officialUrl: "http://www.mnias.org",
                tuition: "₹66,000 - ₹1.3 Lakh (Total B.Sc Nursing)"
            }
        },
        {
            query: { name: /Oriental B Ed College/i },
            update: {
                officialUrl: "http://orientalgrouplalburra.in",
                tuition: "₹60,000 - ₹80,000 (Course Total)"
            }
        },
        {
            query: { name: /Shekhawati M.Ed. College/i },
            update: {
                officialUrl: "http://shekhawatibedcollegedundlod.com"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 19 Complete ---");
    process.exit(0);
}

updateWave4Batch19().catch(err => {
    console.error(err);
    process.exit(1);
});
