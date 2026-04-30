const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;
    const inst = await db.collection('institutions').findOne({
        $or: [
            { aisheId: { $exists: true } },
            { institution_id: { $regex: /^[CU]-/ } }
        ]
    });
    if (inst) {
        console.log('Keys:', Object.keys(inst));
        console.log('institution_id:', inst.institution_id);
        console.log('aisheId:', inst.aisheId);
    } else {
        console.log('None found');
    }
    process.exit(0);
}
run();
