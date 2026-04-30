const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function checkJammu() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;
    const inst = await db.collection('institutions').findOne({ name: /Indian Institute of Technology Jammu/i });
    console.log("ID:", inst._id);
    console.log("STABLE KEY:", inst.stableKey);
    console.log("STABLE IMPORT KEY:", inst.stable_import_key);
    process.exit(0);
}
checkJammu();
