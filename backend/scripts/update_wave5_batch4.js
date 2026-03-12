require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave5Batch4() {
    await connectDB();
    
    console.log("--- 🌍 Wave 5 Batch 4: The Global Sweep (Cluster 4) ---");
    
    const enrichData = [
        {
            query: { name: /Murti Devi P.G. College/i },
            update: {
                tuition: "₹12,000 - ₹24,000 (Annual Range Estimate)"
            }
        },
        {
            query: { name: /Faculty of Performing Arts/i },
            update: {
                officialUrl: "http://msubaroda.ac.in",
                tuition: "₹28,320 (Total BPA) / ₹9,720 (Annual MPA)"
            }
        },
        {
            query: { name: /PRO. DEENANATH PANDEY MAHAVIDYALAYA/i },
            update: {
                officialUrl: "http://lkpsm.org",
                tuition: "₹15,000 - ₹30,000 (Annual Range)"
            }
        },
        {
            query: { name: /Chanakya Foundation/i },
            update: {
                officialUrl: "http://chanakayafoundation.com",
                tuition: "₹1.50 Lakh (Teacher Training) / ₹5.10 Lakh (B.Pharm)"
            }
        },
        {
            query: { name: /LALTA PRASAD TIWARI SMARAK MAHAVIDYALAYA/i },
            update: {
                officialUrl: "http://www.lptsm.co.in"
            }
        },
        {
            query: { name: /RAY UMANATH BALI MAHILA MAHAVIDYALAYA/i },
            update: {
                officialUrl: "http://rubiesindia.com",
                tuition: "₹15,000 - ₹25,000 (Annual Range)"
            }
        },
        {
            query: { name: /SBVR Agriculture College/i },
            update: {
                officialUrl: "http://sbvr.in"
            }
        },
        {
            query: { name: /A M TEACHERS TRAINING INSTITUTE/i },
            update: {
                officialUrl: "http://www.amttided.org"
            }
        },
        {
            query: { name: /IDEAL BUSINESS SCHOOL/i },
            update: {
                officialUrl: "http://idealbusinessschool.ac.in",
                tuition: "₹1.20 Lakh - ₹2.40 Lakh (Annual PGDM)"
            }
        },
        {
            query: { name: /S.L.N. Degree College/i },
            update: {
                officialUrl: "http://slndegreecollege.org",
                tuition: "₹39,000 - ₹45,600 (Total Course)"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 5 Batch 4 Complete ---");
    process.exit(0);
}

updateWave5Batch4().catch(err => {
    console.error(err);
    process.exit(1);
});
