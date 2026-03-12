require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const College = require('./models/CollegeSchema');

async function query() {
    await mongoose.connect(process.env.MONGODB_URI);
    const colleges = await College.find({ 
        name: { $regex: /Indian Institute of Management|Thapar|Lovely Professional/i } 
    }).limit(10).select('id name');
    console.log(JSON.stringify(colleges, null, 2));
    mongoose.disconnect();
}

query();
