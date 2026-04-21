const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function diagnostic() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        const samples = [
            { id: 'CORE-IIT-BOMBAY', name: 'Indian Institute of Technology Bombay' },
            { id: 'CORE-IIT-MADRAS', name: 'Indian Institute of Technology Madras' },
            { id: 'CORE-AIIMS-DELHI', name: 'All India Institute of Medical Sciences Delhi' }
        ];

        console.log('--- CEI Truth Linkage Diagnostic ---\n');

        for (const s of samples) {
            console.log(`[Target] ${s.name} (${s.id})`);
            
            // 1. Engineering Cutoffs check
            const cutoffs = await db.collection('engineering_cutoffs').countDocuments({
                $or: [
                    { institute_name_raw: s.name },
                    { institute_name_normalized: new RegExp(s.name, 'i') },
                    { institution_id: s.id }
                ]
            });
            console.log(`  - Engineering Cutoffs: ${cutoffs} records found`);

            // 2. Seat Matrix check
            const seats = await db.collection('seat_matrix').countDocuments({
                $or: [
                    { institute_name_raw: s.name },
                    { institute_name_normalized: new RegExp(s.name, 'i') },
                    { institution_id: s.id }
                ]
            });
            console.log(`  - Seat Matrix: ${seats} records found`);

            // 3. Medical Matrix check
            const medSeats = await db.collection('medical_seat_matrix').countDocuments({
                $or: [
                    { institution_name_raw: new RegExp(s.name, 'i') },
                    { institution_name_clean: new RegExp(s.name, 'i') },
                    { resolved_target_id: s.id }
                ]
            });
            console.log(`  - Medical Seats: ${medSeats} records found`);
            
            console.log('');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

diagnostic();
