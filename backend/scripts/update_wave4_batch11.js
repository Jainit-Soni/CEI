require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function updateWave4Batch11() {
    await connectDB();
    
    console.log("--- 🚀 Wave 4 Batch 11 Data Enrichment ---");
    
    const enrichData = [
        {
            query: { name: /R.P. DEGREE COLLEGE.*KAMALGANJ/i },
            update: {
                officialUrl: "http://rppgcollege.org.in",
                "placements.averagePackage": "10.00 LPA",
                tuition: "₹63,000 (BA Programs)"
            }
        },
        {
            query: { name: /DAYANAND BACHHRAWAN DEGREE COLLEGE/i },
            update: {
                officialUrl: "http://dbpgc.org.in",
                tuition: "₹15,000 - ₹81,250 (Range)"
            }
        },
        {
            query: { name: /THAKUR SHIV PRATAP SINGH MAHAVIDYALAYA/i },
            update: {
                officialUrl: "http://tspsmvshah.org.in"
            }
        },
        {
            query: { name: /ERAM GIRLS.*DEGREE COLLEGE.*INDIRA NAGAR/i },
            update: {
                officialUrl: "http://eramedu.org",
                "placements.averagePackage": "4.00 LPA",
                tuition: "₹1.02 Lakh (Total B.Ed)"
            }
        },
        {
            query: { name: /Swami Govindashram Mahavidyalay.*Mirzapur/i },
            update: {
                officialUrl: "http://sgpgcollege.in"
            }
        },
        {
            query: { name: /K.L.S.College/i },
            update: {
                officialUrl: "http://klscollegenawada.org",
                tuition: "₹5,000 - ₹46,000 (Range)"
            }
        },
        {
            query: { name: /Directorate of Forensic Science/i },
            update: {
                officialUrl: "http://gfsu.edu.in",
                tuition: "₹1.14 - ₹2.16 Lakh (M.Sc)"
            }
        },
        {
            query: { name: /S.D.S. MAHAVIDYALAYA.*ETAH/i },
            update: {
                officialUrl: "http://sdscollege.org.in"
            }
        },
        {
            query: { name: /SUDAMA DEVI BALIKA DEGREE COLLEGE/i },
            update: {
                officialUrl: "http://sdbm.org.in"
            }
        },
        {
            query: { name: /Maa Duraga Girls College.*Jaunpur/i },
            update: {
                officialUrl: "http://maadurga.org.in"
            }
        },
        {
            query: { name: /Sarvseva Mahavidyalaya.*Ghazipur/i },
            update: {
                officialUrl: "https://sarvsevamahavidyalaya.gzp.co.in"
            }
        },
        {
            query: { name: /Raja Ram Mahavidyalaya.*Jaunpur/i },
            update: {
                officialUrl: "http://rajarammahavidyalaya.org.in",
                tuition: "₹15,000 (B.Sc Ag)"
            }
        }
    ];

    for (const item of enrichData) {
        const result = await College.updateOne(item.query, { $set: item.update });
        console.log(`Updated ${item.query.name || 'Regex'}: ${result.modifiedCount} modified.`);
    }

    console.log("\n--- Wave 4 Batch 11 Complete ---");
    process.exit(0);
}

updateWave4Batch11().catch(err => {
    console.error(err);
    process.exit(1);
});
