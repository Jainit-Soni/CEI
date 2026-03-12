require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave5Batch6() {
    await connectDB();
    
    console.log("--- 🌍 Wave 5 Batch 6: The Global Sweep (Cluster 6 - Medical & Specialized) ---");
    
    const enrichData = [
        {
            query: { name: /Anwer Memorial Medical College/i },
            update: {
                officialUrl: "https://akmmc.edu.bd",
                tuition: "$44,000 USD (Total MBBS Estimate)"
            }
        },
        {
            query: { name: /Indore Academy/i },
            update: {
                officialUrl: "http://indorenursingcollege.com",
                tuition: "₹20,000 - ₹50,000 (Annual Nursing Estimate)"
            }
        },
        {
            query: { name: /Sree Abirami College of Nursing/i },
            update: {
                officialUrl: "http://abiraminursing.edu.in",
                tuition: "₹3.20 Lakh (Total B.Sc Nursing)"
            }
        },
        {
            query: { name: /C.M. Pharmacy College/i },
            update: {
                officialUrl: "http://www.columbiaiop.ac.in",
                tuition: "₹65,150 (Annual B.Pharm) / ₹51,120 (Annual D.Pharm)"
            }
        },
        {
            query: { name: /Modern College of Nursing/i },
            update: {
                tuition: "₹90,000 - ₹1,20,000 (Annual Private Nursing Range Estimate)"
            }
        },
        {
            query: { name: /K.M. College of Education/i },
            update: {
                officialUrl: "http://www.kmcollegeofeducation.org",
                tuition: "₹48,400 (Annual B.Ed)"
            }
        },
        {
            query: { name: /Sant Longowal Institute of Engineering and Technology/i },
            update: {
                officialUrl: "http://sliet.ac.in",
                tuition: "₹2.86 Lakh - ₹3.44 Lakh (Total B.Tech)",
                "placements.averagePackage": "11.07 LPA",
                "placements.highestPackage": "27.00 LPA"
            }
        },
        {
            query: { name: /National Sugar Institute/i },
            update: {
                officialUrl: "http://nsi.gov.in",
                tuition: "₹22,000 (Total PG Diploma) / ₹20,500 (Total Certificate)",
                "placements.averagePackage": "4.00 LPA",
                "placements.highestPackage": "6.00 LPA"
            }
        },
        {
            query: { name: /S.R. Pharmacy College/i },
            update: {
                officialUrl: "http://srpharamacycollege.com",
                tuition: "₹60,000 (Annual D.Pharm Estimate)"
            }
        },
        {
            query: { name: /Navdeep Teachers Training College/i },
            update: {
                officialUrl: "http://navbhartittc.navbhartipiti.com",
                tuition: "₹1.00 Lakh (Total 2-Year B.Ed Range)"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 5 Batch 6 Complete ---");
    process.exit(0);
}

updateWave5Batch6().catch(err => {
    console.error(err);
    process.exit(1);
});
