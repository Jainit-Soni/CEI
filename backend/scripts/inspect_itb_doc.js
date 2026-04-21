const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        const doc = await db.collection('engineering_cutoffs').findOne({ institution_id: 'CORE-IIT-BOMBAY' });
        console.log('--- Sample Cutoff Doc ---');
        console.log(JSON.stringify(doc, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
