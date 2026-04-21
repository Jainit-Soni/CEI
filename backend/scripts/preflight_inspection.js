const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });
const fs = require('fs');
const path = require('path');

async function runPreflight() {
    try {
        console.log('--- CEI Preflight Inspection [Batch 1] ---');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        // 1. Discover Live Institution IDs (Dialect: LIVE)
        const flagships = [
            'Indian Institute of Technology Bombay',
            'Indian Institute of Technology Madras',
            'National Institute of Technology Tiruchirappalli',
            'Indian Institute of Information Technology Allahabad',
            'All India Institute of Medical Sciences New Delhi'
        ];

        console.log('\n[1] Discovering Live Institution IDs:');
        const liveSample = {};
        for (const name of flagships) {
            const inst = await db.collection('institutions').findOne({ name });
            liveSample[name] = inst?.id || 'MISSING';
            console.log(`- ${name} -> ${liveSample[name]}`);
        }

        // 2. Discover Current Truth Dialects (Dialect: LEGACY)
        console.log('\n[2] Discovering Current Truth Dialects:');
        const collections = ['engineering_cutoffs', 'seat_matrix', 'medical_seat_matrix'];
        const legacySample = {};
        
        for (const colName of collections) {
            const sample = await db.collection(colName).findOne({ institution_id: { $exists: true, $regex: /^CORE-/ } });
            legacySample[colName] = sample ? { 
                id: sample.institution_id, 
                name: sample.institute_name_raw || sample.mcc_id 
            } : 'NO_STAMPED_DATA';
            console.log(`- ${colName}: ${JSON.stringify(legacySample[colName])}`);
        }

        // 3. Discover Registered API Routes
        console.log('\n[3] Discovering Actual Registered Routes:');
        const serverPath = 'backend/server.js';
        const serverContent = fs.readFileSync(serverPath, 'utf8');
        
        const possibleRoutes = [
            { label: 'Engineering Cutoffs', file: 'backend/routes/engineeringCutoffRoutes.js', prefix: '/api/cutoffs' },
            { label: 'Engineering Seats', file: 'backend/routes/seatMatrixRoutes.js', prefix: '/api/seats' },
            { label: 'Verified Data', file: 'backend/routes/verifiedData.js', prefix: '/api/verified' }
        ];

        for (const route of possibleRoutes) {
            if (fs.existsSync(route.file)) {
                console.log(`- ${route.label} [OK]: ${route.file}`);
            } else {
                console.log(`- ${route.label} [MISSING FILE]`);
            }
        }

        // 4. Environment Reality
        console.log('\n[4] Environment Reality:');
        const PORT = process.env.PORT || 4000;
        console.log(`- API_BASE_URL (Discovered): http://localhost:${PORT}`);

        console.log('\n--- PREFLIGHT COMPLETE ---');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

runPreflight();
