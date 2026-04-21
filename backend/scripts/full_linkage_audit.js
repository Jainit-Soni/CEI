const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function fullAudit() {
    try {
        console.log('=== CEI Batch 1 Final Verification Report ===\n');
        
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        const coreInsts = await db.collection('institutions').find({ isCore: true }).toArray();
        console.log(`Found ${coreInsts.length} Flagship Institutions in Registry.\n`);

        const results = {
            Total: coreInsts.length,
            Engineering_Bound: 0,
            Medical_Bound: 0,
            Unbound: 0
        };

        const samples = [];

        for (const inst of coreInsts) {
            const id = inst.id;
            const eCount = await db.collection('engineering_cutoffs').countDocuments({ institution_id: id });
            const sCount = await db.collection('seat_matrix').countDocuments({ institution_id: id });
            const mCount = await db.collection('medical_seat_matrix').countDocuments({ institution_id: id });

            const isEngBound = eCount > 0 || sCount > 0;
            const isMedBound = mCount > 0;

            if (isEngBound) results.Engineering_Bound++;
            if (isMedBound) results.Medical_Bound++;
            if (!isEngBound && !isMedBound) results.Unbound++;

            if (samples.length < 15 && (isEngBound || isMedBound)) {
                samples.push({
                    Name: inst.name.substring(0, 40) + '...',
                    ID: id,
                    Cutoffs: eCount,
                    Seats: sCount,
                    MedSeats: mCount
                });
            }
        }

        console.log('--- Coverage Summary ---');
        console.table(results);

        console.log('\n--- Linkage Samples ---');
        console.table(samples);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fullAudit();
