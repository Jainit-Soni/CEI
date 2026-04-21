const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        const ids = await db.collection('medical_seat_matrix').distinct('mcc_id');
        console.log('--- Distinct MCC IDs (Total: ' + ids.length + ') ---');
        console.log(JSON.stringify(ids.slice(0, 50), null, 2));
        
        // Specifically look for AIIMS Delhi (Legacy ID: CORE-ALL-INDIA-INSTITUTE-OF-MEDICAL-SCIENCES-NEW-DELHI)
        // From previous logs, it's NOT in the list? Let's search for "New Delhi" in the header.
        console.log('\nSearching for New Delhi in headers...');
        const delhi = await db.collection('medical_seat_matrix').find({ institution_header_raw: /New Delhi/i }).limit(5).toArray();
        delhi.forEach(d => console.log(`- ${d.institution_header_raw} [MCC: ${d.mcc_id}]`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
