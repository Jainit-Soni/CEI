const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

async function debug() {
    await mongoose.connect(process.env.MONGODB_URI);
    const MedicalCutoff = require('../models/MedicalCutoffSchema');
    
    const quota = 'All India';
    const category = 'OPEN';
    const programType = 'MBBS';
    
    console.log(`Querying: ${programType}, ${quota}, ${category}`);
    
    const count = await MedicalCutoff.countDocuments({ program_type: programType, quota, category });
    console.log(`Total matching docs: ${count}`);
    
    const stats = await MedicalCutoff.aggregate([
        {
            $match: {
                program_type: programType,
                quota: quota,
                category: category
            }
        },
        {
            $group: {
                _id: "$medical_entity_id",
                ranks: { $push: "$closing_rank" }
            }
        },
        {
            $limit: 5
        }
    ]);
    
    console.log("Aggregation Samples:", JSON.stringify(stats, null, 2));
    process.exit(0);
}

debug();
