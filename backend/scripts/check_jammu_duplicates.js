const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function checkJammuDuplicates() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;
    const results = await db.collection('institutions').find({ name: /Indian Institute of Technology Jammu/i }).toArray();
    console.log("FOUND", results.length, "RECORDS");
    results.forEach(r => {
        console.log(`- ID: ${r._id}, instId: ${r.institution_id}, name: ${r.name}`);
    });
    process.exit(0);
}
checkJammuDuplicates();
