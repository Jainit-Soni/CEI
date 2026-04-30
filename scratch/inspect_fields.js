const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env.local') });

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        
        const cutoffs = await db.collection('engineering_cutoffs').findOne({ source_authority: 'JoSAA' });
        console.log('--- JoSAA FIELDS ---');
        console.log(cutoffs ? Object.keys(cutoffs) : 'None found');
        if (cutoffs) console.log('Sample Code:', cutoffs.institute_code || cutoffs.code || cutoffs.id);

        const ranking = await db.collection('rankings').findOne({});
        console.log('\n--- RANKING FIELDS ---');
        console.log(ranking ? Object.keys(ranking) : 'None found');

        const inst = await db.collection('institutions').findOne({ aicte_id: { $exists: true } });
        console.log('\n--- INSTITUTION FIELDS ---');
        console.log(inst ? Object.keys(inst) : 'None found');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
