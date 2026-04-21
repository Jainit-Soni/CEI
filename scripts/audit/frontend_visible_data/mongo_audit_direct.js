const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

async function runAudit() {
    require('dotenv').config({ path: path.join(__dirname, '../../../backend/.env.local') });
    const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB || 'cei_v2';
    const client = new MongoClient(url);

    try {
        await client.connect();
        const db = client.db(dbName);
        const col = db.collection('institutions');
        
        console.log(`[AUDIT] Connected to MongoDB. Fetching records...`);
        const colleges = await col.find({}).toArray();
        const total = colleges.length;
        console.log(`[AUDIT] Total records: ${total}`);

        const stats = {
            totalColleges: total,
            hasAddressText: 0,
            hasOfficialWebsite: 0,
            hasNIRF: 0,
            hasFees: 0,
            hasPlacements: 0,
            hasSeats: 0,
            hasCourses: 0,
            hasCutoffs: 0
        };

        for (const c of colleges) {
            // Check for both legacy and AICTE field names
            if (c.location || c.address || c.address_line1) stats.hasAddressText++;
            if (c.website || c.official_website || c.officialUrl) stats.hasOfficialWebsite++;
            if (Array.isArray(c.rankings) && c.rankings.some(r => String(r.source || '').includes('NIRF'))) stats.hasNIRF++;
            
            // Truth checks (based on AICTE record structure or legacy)
            if (c.fees?.isVerified || c.tuition_fees || c.tuition) stats.hasFees++;
            if (c.placements?.source || c.avg_package) stats.hasPlacements++;
            if (Array.isArray(c.courses) && c.courses.length > 0) stats.hasCourses++;
            
            // Specific AICTE truth indicator: if 'course_details_ref' exists, it implies course data availability
            if (c.course_details_ref) stats.hasCourses++; 
        }

        const report = { total, stats, percentages: {} };
        Object.keys(stats).forEach(k => {
            if (k !== 'totalColleges') report.percentages[k] = ((stats[k] / total) * 100).toFixed(2) + '%';
        });

        fs.writeFileSync(path.join(__dirname, 'audit_results_mongo_final.json'), JSON.stringify(report, null, 2));
        console.log(`[AUDIT] Final Mongo residency audit saved.`);

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
        process.exit(0);
    }
}

runAudit();
