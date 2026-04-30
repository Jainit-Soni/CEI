const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;
    const inst = await db.collection('institutions').findOne({
        stable_import_key: { $exists: true }
    });
    if (inst) {
        console.log('stable_import_key:', inst.stable_import_key);
    } else {
        console.log('None found');
    }
    process.exit(0);
}
run();
