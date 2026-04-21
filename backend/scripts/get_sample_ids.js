const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        const iitb = await db.collection('institutions').findOne({ name: /Indian Institute of Technology.*Bombay|Mumbai/i });
        const aiims = await db.collection('institutions').findOne({ name: /All India Institute of Medical Sciences.*Delhi/i });
        console.log('--- Real IDs ---');
        console.log(JSON.stringify({ iitb_id: iitb?.id, aiims_id: aiims?.id }, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
