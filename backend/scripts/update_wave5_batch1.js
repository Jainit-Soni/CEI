require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave5Batch1() {
    await connectDB();
    
    console.log("--- 🌍 Wave 5 Batch 1: The Global Sweep (Cluster 1) ---");
    
    const enrichData = [
        {
            query: { name: /Vidhyadeep Institute of Engineering and Technology/i },
            update: {
                officialUrl: "http://vidhyadeepuni.ac.in",
                "placements.averagePackage": "5.50 LPA",
                "placements.highestPackage": "12.00 LPA",
                tuition: "₹75,600 - ₹4.4 Lakh (Course Range)"
            }
        },
        {
            query: { name: /Seva Varati B ED College/i },
            update: {
                officialUrl: "http://www.seva-varati.org",
                tuition: "₹3,500 per year"
            }
        },
        {
            query: { name: /Kalpana Mahavidyalaya.*Vijaipur/i },
            update: {
                officialUrl: "http://www.kalpanacollege.org"
            }
        },
        {
            query: { name: /Rao Hospital.*Coimbatore/i },
            update: {
                officialUrl: "http://raohospital.com"
            }
        },
        {
            query: { name: /Ambedkar Mahila Degree College.*Amawan/i },
            update: {
                officialUrl: "http://www.amdcr.in",
                tuition: "₹2,115 - ₹20,693 (Course Range)"
            }
        },
        {
            query: { name: /B D Barad B ED College/i },
            update: {
                officialUrl: "http://www.kdbaradtrust.org"
            }
        },
        {
            query: { name: /Gurukul College.*Berasia/i },
            update: {
                officialUrl: "http://gurukulcollege2.com", // Based on search email
                tuition: "₹70,000 - ₹2.4 Lakh (Total Degree)"
            }
        },
        {
            query: { name: /Sri Jayaram Institute of Engineering and Technology/i },
            update: {
                officialUrl: "http://www.sjiet.org",
                "placements.averagePackage": "6.00 LPA",
                "placements.highestPackage": "10.00 LPA",
                tuition: "₹2.00 Lakh - ₹3.48 Lakh (Total BE)"
            }
        },
        {
            query: { name: /BAM Vivekananda B ED College/i },
            update: {
                officialUrl: "http://bvbedcollege.org"
            }
        },
        {
            query: { name: /k k college Gokul mathura/i },
            update: {
                officialUrl: "http://kkdegreecollege.com"
            }
        },
        {
            query: { name: /Maa Yashoda Noubat mahavidyalay/i },
            update: {
                officialUrl: "http://mynm.org.in/"
            }
        },
        {
            query: { name: /WOMENS ISLAMIYA ARTS AND SCIENCE COLLEGE/i },
            update: {
                officialUrl: "http://wicwandoor.in",
                tuition: "₹54,000 - ₹67,500"
            }
        },
        {
            query: { name: /CT Institute of Higher Studies/i },
            update: {
                officialUrl: "https://www.ctgroup.in",
                "placements.averagePackage": "8.00 LPA",
                "placements.highestPackage": "88.00 LPA",
                tuition: "₹98,445 - ₹2.56 Lakh (Total UG)"
            }
        },
        {
            query: { name: /Sri Sai Shikshan Sansthan/i },
            update: {
                officialUrl: "http://srisaishikshansansthan.com",
                tuition: "₹84,000 (Total B.Ed)"
            }
        },
        {
            query: { name: /Champa Devi Mahila Mahavidyalay/i },
            update: {
                officialUrl: "http://champadevimahavidy.wix.com/college",
                tuition: "₹24,000 - ₹38,000 (Course Range)"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 5 Batch 1 Complete ---");
    process.exit(0);
}

updateWave5Batch1().catch(err => {
    console.error(err);
    process.exit(1);
});
