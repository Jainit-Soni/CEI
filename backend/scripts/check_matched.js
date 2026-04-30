const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;
    const report = JSON.parse(fs.readFileSync('data/truth/match_report.json', 'utf8'));
    const matchedIds = report.logs.filter(l => l.status === 'matched').map(l => l.match_id);
    const samples = await db.collection('institutions').find({
        institution_id: { $in: matchedIds.slice(0, 20) }
    }).toArray();
    console.log(JSON.stringify(samples.map(s => ({ name: s.name, state: s.state })), null, 2));
    process.exit(0);
}
run();
