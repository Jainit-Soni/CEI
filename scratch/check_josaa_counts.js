const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env.local') });

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        
        console.log('--- JoSAA Mapping Audit (Elite Short IDs) ---');
        const docs = await db.collection('josaa_mappings').find({ 
            institution_id: { $regex: /^CORE-(IIT|NIT)-/ }
        }).limit(5).toArray();
        
        docs.forEach(d => console.log(`${d.josaa_code}: ${d.institute_name_raw} -> ${d.institution_id}`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
