const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        const docs = await db.collection('medical_seat_matrix').find({ 
            institution_header_raw: /AIIMS/i 
        }).toArray();
        
        const map = {};
        docs.forEach(d => {
            if (d.mcc_id) {
                // Heuristic to extract city name from header
                const match = d.institution_header_raw.match(/AIIMS,\s*([^,]+)/i);
                const city = match ? match[1].trim() : 'Unknown';
                map[d.mcc_id] = city;
            }
        });
        
        console.log('--- AIIMS MCC ID Map ---');
        console.log(JSON.stringify(map, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
