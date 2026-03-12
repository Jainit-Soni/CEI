require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const College = require('./models/CollegeSchema');

async function audit() {
    await mongoose.connect(process.env.MONGODB_URI);
    const topColleges = await College.find({ ceiScore: { $gt: 0 } })
        .sort({ ceiScore: -1 })
        .limit(20)
        .select('id name ceiScore competitivenessBand placements.averagePackage tuition');
    console.log(JSON.stringify(topColleges, null, 2));
    mongoose.disconnect();
}

audit();
