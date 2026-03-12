require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function verify() {
    await connectDB();
    
    console.log("--- 🧐 Post-Sanitization Verification ---");
    
    const total = await College.countDocuments();
    const sanitizedUrl = await College.countDocuments({ officialUrl: "Not Available" });
    const sanitizedPkg = await College.countDocuments({ "placements.averagePackage": "Not Available" });
    const sanitizedTuition = await College.countDocuments({ tuition: "Not Available" });

    console.log(`Total Colleges Remaining: ${total}`);
    console.log(`Colleges with "Not Available" URL: ${sanitizedUrl}`);
    console.log(`Colleges with "Not Available" Package: ${sanitizedPkg}`);
    console.log(`Colleges with "Not Available" Tuition: ${sanitizedTuition}`);

    console.log("\nSample check for 'Not Available' in package:");
    const samples = await College.find({ "placements.averagePackage": "Not Available" }).limit(3).lean();
    samples.forEach(s => console.log(`- ${s.name}: Package = ${s.placements.averagePackage}`));

    process.exit(0);
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
