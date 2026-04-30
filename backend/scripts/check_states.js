const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;
    const states = await db.collection('institutions').aggregate([
        { $group: { _id: '$state', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]).toArray();
    console.log(JSON.stringify(states, null, 2));
    process.exit(0);
}
run();
