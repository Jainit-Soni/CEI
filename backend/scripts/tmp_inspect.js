require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function run() {
    await connectDB();
    const college = await College.findOne({ id: 'S-22757' });
    if (college) {
        console.log('ID:', college.id);
        console.log('SourceMetadata:', JSON.stringify(college.sourceMetadata));
        console.log('StateRepairSource:', college.stateRepairSource);
        console.log('Courses Count:', college.courses ? college.courses.length : 0);
    } else {
        console.log('College S-22757 not found');
    }
    
    // Also check total count of colleges with sourceMetadata
    const count = await College.countDocuments({ "sourceMetadata.lastInboundSource": { $exists: true } });
    console.log('Colleges with sourceMetadata:', count);
    
    const count2 = await College.countDocuments({ "stateRepairSource": { $exists: true } });
    console.log('Colleges with stateRepairSource:', count2);

    mongoose.connection.close();
}

run();
