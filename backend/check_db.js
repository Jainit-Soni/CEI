const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function checkDB() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const item = await db.collection('colleges').findOne({});
    console.log("Sample College Keys:", Object.keys(item));
    console.log("Has cei_id?", !!item.cei_id);
    console.log("Has id?", !!item.id);
    console.log("Sample ID value:", item.id || item.cei_id);
    process.exit(0);
}
checkDB().catch(console.error);
