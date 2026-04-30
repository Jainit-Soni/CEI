const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env.local' });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const allColleges = await mongoose.connection.db.collection('institutions').find({}).toArray();
    
    let found = 0;
    for (const doc of allColleges) {
        const str = JSON.stringify(doc);
        if (str.includes('"C-')) {
            console.log(doc.id, doc.name);
            console.log(str.match(/"C-\d+"/g));
            found++;
            if (found > 5) break;
        }
    }
    console.log(`Found ${found} docs with C-`);
    process.exit(0);
}
run();
