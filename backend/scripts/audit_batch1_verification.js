const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });

async function runAudit() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        const results = {};

        // 1. Institution Counts (Corrected for normalized fields)
        const institutions = db.collection('institutions');
        results.totalInstitutions = await institutions.countDocuments({});
        
        // Search by alternative name fields
        results.iits = await institutions.countDocuments({ $or: [
            { institution_name: /Indian Institute of Technology/i },
            { name: /Indian Institute of Technology/i },
            { id: /^CORE-IIT/i }
        ]});
        results.nits = await institutions.countDocuments({ $or: [
            { institution_name: /National Institute of Technology/i },
            { name: /National Institute of Technology/i },
            { id: /^CORE-NIT/i }
        ]});
        results.iiits = await institutions.countDocuments({ $or: [
            { institution_name: /Indian Institute of Information Technology/i },
            { name: /Indian Institute of Information Technology/i },
            { id: /^CORE-IIIT/i }
        ]});
        results.aiims = await institutions.countDocuments({ $or: [
            { institution_name: /AIIMS|All India Institute of Medical Sciences/i },
            { name: /AIIMS|All India Institute of Medical Sciences/i },
            { id: /^CORE-AIIMS/i }
        ]});

        // 3. Medical Data Scan (Claimed 198 records)
        results.medicalScan = {};
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        results.collections = collectionNames;
        
        for(const colName of collectionNames) {
            const count = await db.collection(colName).countDocuments({
                $or: [
                    { counselling_type: /MCC|Medical|NEET/i },
                    { exam: /NEET/i },
                    { source: /MCC/i },
                    { counselling: /MCC/i }
                ]
            });
            if (count > 0) results.medicalScan[colName] = count;
        }

        // 4. Batch 1 Flagship Presence (Search by name patterns in Institutions)
        results.flagships = {
            iit_count: await institutions.countDocuments({ institution_name: /Indian Institute of Technology/i }),
            nit_count: await institutions.countDocuments({ institution_name: /National Institute of Technology/i }),
            iiit_count: await institutions.countDocuments({ institution_name: /Indian Institute of Information Technology/i }),
            aiims_count: await institutions.countDocuments({ institution_name: /AIIMS|All India Institute of Medical Sciences/i })
        };

        // 5. Check courses count for these institutions specifically
        const coreIds = (await institutions.find({ institution_name: /IIT|NIT|IIIT|AIIMS/i }).project({ institution_id: 1 }).toArray()).map(d => d.institution_id);
        results.courses_for_flagships = await db.collection('course_offerings').countDocuments({ institution_id: { $in: coreIds } });

        console.log('--- Brutally Accurate Audit Data ---');
        console.log(JSON.stringify(results, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

runAudit();
