const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function checkIndex() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const College = require('../models/CollegeSchema');
        
        const count = await College.countDocuments();
        const stateStats = await College.aggregate([
            { $group: { _id: '$state', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        
        const sampleMH = await College.findOne({ state: /maharashtra/i });
        
        console.log({ 
            totalCount: count, 
            topStates: stateStats,
            sampleMH: sampleMH ? {
                id: sampleMH.id,
                name: sampleMH.name,
                state: sampleMH.state,
                stableKey: sampleMH.stableKey,
                aisheCode: sampleMH.aisheCode
            } : 'Not Found'
        });
        
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkIndex();
