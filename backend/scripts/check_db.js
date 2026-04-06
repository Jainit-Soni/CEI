require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function check() {
    await connectDB();
    const count = await College.countDocuments({});
    console.log(`\n----------------------------------------`);
    console.log(`📊 DATABASE STATUS CHECK`);
    console.log(`----------------------------------------`);
    console.log(`Collection : ${College.collection.name}`);
    console.log(`Count      : ${count}`);
    console.log(`----------------------------------------\n`);
    
    // Check a sample record
    const sample = await College.findOne({ isCore: true });
    if (sample) {
        console.log(`✅ Sample Core Institute: ${sample.name}`);
        console.log(`   Location: ${sample.location}`);
        console.log(`   isCore: ${sample.isCore}`);
    }

    mongoose.connection.close();
}

check().catch(console.error);
