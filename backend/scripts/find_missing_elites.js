const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const allColleges = await mongoose.connection.db.collection('institutions').find({}).toArray();
    
    let missing = [];
    for (const c of allColleges) {
        const idUpper = c.institution_id?.toUpperCase() || '';
        if (idUpper.includes('-IIT-') || idUpper.includes('-NIT-') || idUpper.includes('-IIIT-')) {
            const hasFees = c.fees?.isVerified || c.fees?.totalFee;
            const hasPlac = c.placements?.isVerified || c.placements?.averagePackage;
            if (!hasFees || !hasPlac) {
                missing.push(c.institution_id);
            }
        }
    }
    console.log(`Missing Elite Institutions: ${missing.length}`);
    console.log(missing.slice(0, 10));
    process.exit(0);
}
run();
