const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env.local') });

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        
        const inst = await db.collection('institutions').findOne({ institution_id: 'CORE-IIT-BOMBAY' });
        console.log('--- CORE-IIT-BOMBAY All Fields ---');
        console.log(JSON.stringify(inst, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
