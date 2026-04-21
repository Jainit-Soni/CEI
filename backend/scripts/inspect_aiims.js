const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        const docs = await db.collection('medical_seat_matrix').find({ 
            $or: [
                { institution_name_raw: /AIIMS|All India Institute/i },
                { institution_header_raw: /AIIMS|All India Institute/i }
            ]
        }).limit(10).toArray();
        
        console.log(`Found ${docs.length} AIIMS-like records`);
        console.log(JSON.stringify(docs, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
