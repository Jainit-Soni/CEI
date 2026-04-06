require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function debug() {
    await connectDB();
    const docs = await College.find({ website: { $exists: true } }).limit(5).lean();
    console.log(JSON.stringify(docs, null, 2));
    
    const countWithWebsite = await College.countDocuments({ website: { $exists: true, $ne: null, $ne: "" } });
    console.log(`\nFound ${countWithWebsite} documents with website field.`);
    
    mongoose.connection.close();
}

debug().catch(console.error);
