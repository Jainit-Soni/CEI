const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
const uri = process.env.MONGODB_URI + 'cei_v2';
mongoose.connect(uri).then(async () => {
    const College = require('./models/CollegeSchema');
    const doc = await College.findOne({ 
        $or: [
            { 'meta.dteCode': 'EN1101' }, 
            { id: 'EN1101' }, 
            { aisheCode: 'EN1101' },
            { id: /EN1101/ },
            { dteCode: 'EN1101' }
        ] 
    });
    console.log("CEI_v2 DB search for EN1101:", doc ? doc.name : 'Not found');
    process.exit();
});
