const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const connectDB = require('../config/db');
const College = require('../models/CollegeSchema');

const buildIndexes = async () => {
    await connectDB();
    console.log('Force building compound indexes for the College collection...');

    try {
        await College.createIndexes();
        console.log('✅ Synchronized all compound indexes successfully!');

        const indexes = await College.listIndexes();
        console.log('Current Indexes:', JSON.stringify(indexes, null, 2));

    } catch (error) {
        console.error('❌ Error building indexes:', error);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
};

buildIndexes();
