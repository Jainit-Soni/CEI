const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function run() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error(`MONGODB_URI not found in ${path.join(__dirname, '..', '.env.local')}`);
        }
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        const targets = [
            { name: 'IIIT Allahabad', query: /Information Technology.*Allahabad/i },
            { name: 'AIIMS Delhi', query: /Medical Sciences.*Delhi/i }
        ];

        for (const target of targets) {
            console.log(`Searching for ${target.name}...`);
            const results = await db.collection('institutions').find({ name: target.query }).toArray();
            if (results.length === 0) {
                console.log('  -> No results found.');
            } else {
                results.forEach(r => console.log(`  -> Found: "${r.name}" [ID: ${r.id}] (isCore: ${r.isCore}, searchBoost: ${r.searchBoost})`));
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
