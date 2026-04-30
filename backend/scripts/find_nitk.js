const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function findNITK() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;
    const inst = await db.collection('institutions').findOne({ name: /National Institute of Technology.*Karnataka/i });
    console.log(JSON.stringify(inst, null, 2));
    process.exit(0);
}
findNITK();
