const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function inspectMedical() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const doc = await mongoose.connection.db.collection('medical_seat_matrix').findOne({});
        console.log('Sample Medical Doc:');
        console.log(JSON.stringify(doc, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspectMedical();
