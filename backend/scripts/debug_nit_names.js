const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        const ids = ['CORE-NIT-TRICHY', 'CORE-IIIT-ALLAHABAD'];
        const docs = await db.collection('institutions').find({ id: { $in: ids } }).toArray();
        console.log(JSON.stringify(docs.map(d => ({ id: d.id, name: d.name })), null, 2));

        // Also check what engineering_cutoffs has for "Trichy"
        const samples = await db.collection('engineering_cutoffs').find({ institute_name_raw: /Trichy|Allahabad/i }).limit(5).toArray();
        console.log('\nSample names in engineering_cutoffs:');
        console.log(JSON.stringify(samples.map(s => s.institute_name_raw), null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
