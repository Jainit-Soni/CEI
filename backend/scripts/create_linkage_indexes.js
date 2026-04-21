const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function createIndexes() {
    try {
        console.log('--- CEI Truth Indexing ---');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        const collections = ['engineering_cutoffs', 'seat_matrix', 'medical_seat_matrix'];
        
        for (const col of collections) {
            console.log(`Creating index on ${col}.institution_id...`);
            await db.collection(col).createIndex({ institution_id: 1 });
            console.log(`Success: ${col}.institution_id index created.`);
        }

        console.log('\n✅ All truth linkage indexes are live.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Indexing failed:', err);
        process.exit(1);
    }
}

createIndexes();
