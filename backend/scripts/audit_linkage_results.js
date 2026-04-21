const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function runAudit() {
    try {
        console.log('=== CEI Batch 1 Linkage Reality Report ===\n');
        
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        const targets = [
            { id: 'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-MUMBAI', type: 'Engineering' },
            { id: 'CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-CHENNAI', type: 'Engineering' },
            { id: 'CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-TIRUCHIRAPALLI', type: 'Engineering' },
            { id: 'CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-ALLAHABAD', type: 'Engineering' },
            { id: 'CORE-ALL-INDIA-INSTITUTE-OF-MEDICAL-SCIENCES-NEW-DELHI', type: 'Medical' }
        ];

        const collections = {
            Engineering: ['engineering_cutoffs', 'seat_matrix'],
            Medical: ['medical_seat_matrix']
        };

        for (const t of targets) {
            console.log(`[Institution] ${t.id} (${t.type})`);
            
            const relevantCols = collections[t.type];
            for (const col of relevantCols) {
                const count = await db.collection(col).countDocuments({ institution_id: t.id });
                const status = count > 0 ? '✅ BOUND' : '❌ DISCONNECTED';
                console.log(`  - ${col.padEnd(20)}: ${count.toString().padStart(5)} records ${status}`);
            }
            console.log('');
        }

        // Global stats
        console.log('--- Global Stamping Stats ---');
        const eCount = await db.collection('engineering_cutoffs').countDocuments({ institution_id: /^CORE-/ });
        const sCount = await db.collection('seat_matrix').countDocuments({ institution_id: /^CORE-/ });
        const mCount = await db.collection('medical_seat_matrix').countDocuments({ institution_id: /^CORE-/ });

        console.log(`Total Stamped Cutoffs: ${eCount}`);
        console.log(`Total Stamped Seats:   ${sCount}`);
        console.log(`Total Stamped Medical: ${mCount}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

runAudit();
