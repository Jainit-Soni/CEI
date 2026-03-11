const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
const College = require('../models/CollegeSchema');

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        // Search for scores around 11 (due to float precision)
        const colleges = await College.find({
            ceiScore: { $gte: 10.5, $lte: 11.5 }
        }).select('id name shortName location ceiScore rankingTier').lean();

        console.log('Colleges with score ~11:');
        console.log(JSON.stringify(colleges, null, 2));

        // Also check if there's any record that MIGHT be a duplicate for IIM Bangalore
        const possibleIIMB = await College.find({
            $or: [
                { name: /IIM/i },
                { shortName: /IIM/i }
            ],
            location: /Bangalore|Bengaluru/i
        }).select('id name shortName location ceiScore').lean();

        console.log('\nAll IIM Bangalore candidates:');
        console.log(JSON.stringify(possibleIIMB, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
