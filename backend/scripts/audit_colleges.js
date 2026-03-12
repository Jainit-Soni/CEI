require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function audit() {
    await connectDB();
    
    console.log("--- 🕵️ Institutional Sparsity Audit Starting ---");
    
    const totalColleges = await College.countDocuments();
    console.log(`Total colleges in database: ${totalColleges}`);

    // Criteria 1: Absolute Zero (Name + Location only)
    const absoluteZero = await College.countDocuments({
        $and: [
            { $or: [{ officialUrl: null }, { officialUrl: "" }] },
            { $or: [{ acceptedExams: null }, { acceptedExams: { $size: 0 } }] },
            { $or: [{ "placements.averagePackage": null }, { "placements.averagePackage": "" }] },
            { $or: [{ overview: null }, { overview: "" }] },
            { $or: [{ tuition: null }, { tuition: "" }] }
        ]
    });

    // Criteria 2: User Defined (No Exam, No URL, No Avg Pkg)
    const userDefinedSparsity = await College.countDocuments({
        $and: [
            { $or: [{ officialUrl: null }, { officialUrl: "" }] },
            { $or: [{ acceptedExams: null }, { acceptedExams: { $size: 0 } }] },
            { $or: [{ "placements.averagePackage": null }, { "placements.averagePackage": "" }] }
        ]
    });

    // Criteria 3: No official URL at all (often high quality but missing site)
    const noUrl = await College.countDocuments({ $or: [{ officialUrl: null }, { officialUrl: "" }] });

    console.log("\nAudit Results:");
    console.log(`1. Absolute Zero Data (Name/Location only): ${absoluteZero}`);
    console.log(`2. User Criteria (No Exam, No URL, No Avg Pkg): ${userDefinedSparsity}`);
    console.log(`3. Missing Official URL: ${noUrl}`);

    console.log("\n-------------------------------------------");
    console.log("Sample of sparse colleges (User Criteria):");
    const samples = await College.find({
        $and: [
            { $or: [{ officialUrl: null }, { officialUrl: "" }] },
            { $or: [{ acceptedExams: null }, { acceptedExams: { $size: 0 } }] },
            { $or: [{ "placements.averagePackage": null }, { "placements.averagePackage": "" }] }
        ]
    }).limit(5).select('name location');
    
    samples.forEach((s, i) => console.log(`${i+1}. ${s.name} (${s.location})`));

    process.exit(0);
}

audit().catch(err => {
    console.error(err);
    process.exit(1);
});
