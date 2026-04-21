const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        const docs = await db.collection('institutions').find({ isCore: true }).toArray();
        console.log('--- Current Core Institutions in DB ---');
        console.log(JSON.stringify(docs.map(d => ({ id: d.id, name: d.name })), null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
