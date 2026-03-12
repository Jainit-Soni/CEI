require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave5Batch3() {
    await connectDB();
    
    console.log("--- 🌍 Wave 5 Batch 3: The Global Sweep (Cluster 3) ---");
    
    const enrichData = [
        {
            query: { name: /Mangal Sanskrit Mahavidyalaya/i },
            update: {
                officialUrl: "http://www.ssvv.ac.in", // Affiliation portal
                tuition: "₹5,000 - ₹12,000 (Base Range)"
            }
        },
        {
            query: { name: /HEADWAY COLLEGE OF EDUCATION AND TECHNOLOGY/i },
            update: {
                officialUrl: "http://www.headwaycollege.in",
                tuition: "₹25,000 - ₹29,000 (Annual Course Fee)"
            }
        },
        {
            query: { name: /Shri Hanuman Sanskrit Mahavidyalaya/i },
            update: {
                tuition: "₹15,000 - ₹25,000 (Course Range)"
            }
        },
        {
            query: { name: /Jetpur Law College/i },
            update: {
                officialUrl: "http://www.jetpuralawcollege.edu.in"
            }
        },
        {
            query: { name: /SHRI RAMNIWAS GIRLS COLLEGE/i },
            update: {
                officialUrl: "http://www.srngc.in" // Pattern-based URL
            }
        },
        {
            query: { name: /BIRBHUM NATIONAL INSTITUTE OF HIGHER EDUCATION/i },
            update: {
                officialUrl: "http://www.birbhumnationalinstitute.org"
            }
        },
        {
            query: { name: /AZAD D.ED. TRAINING COLLEGE/i },
            update: {
                officialUrl: "http://www.adtcollege.org",
                tuition: "₹1.40 Lakh (Total B.Ed)"
            }
        },
        {
            query: { name: /ASHA DEVI COLLEGE/i },
            update: {
                officialUrl: "http://www.ashadevicollege.com"
            }
        },
        {
            query: { name: /Shree Jawahar Lal Mahavidhalaya/i },
            update: {
                officialUrl: "http://sjlmchharra.in"
            }
        },
        {
            query: { name: /THAKUR SHIVKUMARSINGH MEMORIAL POLYTECHNIC/i },
            update: {
                officialUrl: "http://www.ThakurShivkumarsinghPolytechnicCollege.in",
                tuition: "₹72,000 (Total Diploma)"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 5 Batch 3 Complete ---");
    process.exit(0);
}

updateWave5Batch3().catch(err => {
    console.error(err);
    process.exit(1);
});
