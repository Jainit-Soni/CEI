const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env.local') });

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        
        const s = await db.collection('seat_matrix').findOne({});
        console.log('--- Seat Matrix Sample ---');
        console.log(s);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
