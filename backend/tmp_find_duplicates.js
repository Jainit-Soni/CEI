require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const College = require('./models/CollegeSchema');

async function findDuplicates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const duplicates = await College.aggregate([
            { $group: { _id: '$name', count: { $sum: 1 }, ids: { $push: '$id' }, scores: { $push: '$ceiScore' } } },
            { $match: { count: { $gt: 1 } } }
        ]);
        console.log(JSON.stringify(duplicates, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findDuplicates();
