require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function diagnostic() {
    await connectDB();
    const samples = await College.find({ 
        $or: [
            { location: null },
            { location: "" },
            { location: "Not Available" }
        ]
    }).limit(10).lean();
    console.log(JSON.stringify(samples, null, 2));
    process.exit(0);
}

diagnostic().catch(err => {
    console.error(err);
    process.exit(1);
});
