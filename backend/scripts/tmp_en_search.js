const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
mongoose.connect(process.env.MONGODB_URI + 'cei_v2').then(async () => {
    const College = require('./models/CollegeSchema');
    const doc = await College.findOne({ 
        $or: [
            { dteCode: { $regex: /^EN/ } }, 
            { 'meta.dteCode': { $regex: /^EN/ } }, 
            { 'identifiers.dteCode': { $regex: /^EN/ } }, 
            { id: { $regex: /^EN/ } }
        ] 
    });
    console.log('Found any EN code mapping:', doc ? 'YES - ' + doc.id : 'NO');
    process.exit();
});
