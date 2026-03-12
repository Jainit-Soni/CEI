require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave5Batch5() {
    await connectDB();
    
    console.log("--- 🌍 Wave 5 Batch 5: The Global Sweep (Cluster 5 - South Tech) ---");
    
    const enrichData = [
        {
            query: { name: /Sree Chaitanya Institute of Pharmaceutical Sciences/i },
            update: {
                officialUrl: "http://www.scip.ac.in",
                tuition: "₹3.00 Lakh (Total B.Pharm)",
                "placements.averagePackage": "3.50 LPA"
            }
        },
        {
            query: { name: /St JUDE S COLLEGE/i },
            update: {
                officialUrl: "http://www.stjudescollege.co.in",
                tuition: "₹10,000 - ₹22,000 (Annual UG Range)"
            }
        },
        {
            query: { name: /Tirukkoyilur College of Arts and Science/i },
            update: {
                officialUrl: "http://www.tirukkoilurcollege.com",
                tuition: "₹52,000 - ₹73,000 (Total UG Range)"
            }
        },
        {
            query: { name: /Sri Venkateswara Engineering College.*Suryapet/i },
            update: {
                officialUrl: "http://www.sves-srpt.ac.in",
                tuition: "₹2.13 Lakh - ₹2.52 Lakh (Total B.Tech)",
                "placements.averagePackage": "5.00 LPA",
                "placements.highestPackage": "13.00 LPA"
            }
        },
        {
            query: { name: /Pragathi Degree College/i },
            update: {
                officialUrl: "http://pragathidegreecollegeforwomen.in",
                tuition: "₹18,150 - ₹21,780 (Annual UG Range)"
            }
        },
        {
            query: { name: /Vaagdevi Degree and P.G. College/i },
            update: {
                officialUrl: "http://vaagdevicolleges.com",
                tuition: "₹43,000 (3-Year B.Sc) / ₹86,000 (Total MBA)",
                "placements.averagePackage": "4.50 LPA",
                "placements.highestPackage": "40.00 LPA"
            }
        },
        {
            query: { name: /Siddhartha Institute of Technology and Sciences/i },
            update: {
                officialUrl: "http://www.siddhartha.co.in",
                tuition: "₹1.89 Lakh - ₹3.20 Lakh (Total B.Tech)",
                "placements.averagePackage": "4.00 LPA",
                "placements.highestPackage": "41.00 LPA"
            }
        },
        {
            query: { name: /AURORAS TECHNOLOGICAL AND RESEARCH INSTITUTE/i },
            update: {
                officialUrl: "http://atri.edu.in",
                tuition: "₹2.49 Lakh - ₹3.38 Lakh (Total B.Tech)",
                "placements.averagePackage": "8.01 LPA",
                "placements.highestPackage": "50.00 LPA"
            }
        },
        {
            query: { name: /Malla Reddy College of Engineering and Technology/i },
            update: {
                officialUrl: "http://mrcet.com",
                tuition: "₹1.20 Lakh - ₹4.46 Lakh (Total B.Tech Range)",
                "placements.averagePackage": "6.00 LPA",
                "placements.highestPackage": "35.00 LPA"
            }
        },
        {
            query: { name: /St Peters Engineering College/i },
            update: {
                officialUrl: "http://www.stpetershyd.com",
                tuition: "₹3.84 Lakh (Total B.Tech)",
                "placements.averagePackage": "7.00 LPA",
                "placements.highestPackage": "52.00 LPA"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 5 Batch 5 Complete ---");
    process.exit(0);
}

updateWave5Batch5().catch(err => {
    console.error(err);
    process.exit(1);
});
