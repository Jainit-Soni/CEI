const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function findSurathkal() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;
    const inst = await db.collection('institutions').findOne({ name: /Surathkal/i });
    console.log(JSON.stringify(inst, null, 2));
    process.exit(0);
}
findSurathkal();
