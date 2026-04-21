const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Path setup
const backendPath = path.join(__dirname, '../../../backend');
const College = require(path.join(backendPath, 'models/CollegeSchema'));

async function runAudit() {
    console.log(`[AUDIT] Connecting to MongoDB to fetch UI-visible colleges...`);
    
    // Set up environment for the backend
    require('dotenv').config({ path: path.join(backendPath, '.env.local') });
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
    const MONGODB_DB = process.env.MONGODB_DB || 'cei_v2';
    
    await mongoose.connect(MONGODB_URI + MONGODB_DB, { 
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000 
    });
    
    // Explicitly wait for the connection to be active
    if (mongoose.connection.readyState !== 1) {
        console.log("[AUDIT] Waiting for connection...");
        await new Promise(resolve => mongoose.connection.once('connected', resolve));
    }
    
    // Fetch ONLY colleges that are in the institutions collection (System of Record)
    const colleges = await College.find({}).lean().maxTimeMS(60000);
    const total = colleges.length;
    
    console.log(`[AUDIT] MongoDB Load complete. Total records: ${total}`);

    // Pre-indexing for performance (using auxiliary truth files if they exist)
    const vfMap = new Map();
    const verifiedPath = path.join(backendPath, 'data', 'verified', 'verified_fields.ndjson');
    if (fs.existsSync(verifiedPath)) {
        const readline = require('readline');
        const rl = readline.createInterface({ input: fs.createReadStream(verifiedPath), crlfDelay: Infinity });
        for await (const line of rl) {
            if (line.trim()) {
                try {
                    const vf = JSON.parse(line);
                    if (vf.collegeId) {
                        if (!vfMap.has(vf.collegeId)) vfMap.set(vf.collegeId, new Set());
                        vfMap.get(vf.collegeId).add(vf.fieldName);
                    }
                } catch (e) {}
            }
        }
    }

    const stats = {
        totalColleges: total,
        traversedCount: 0,
        hasAddressText: 0,
        hasAddressLink: 0,
        hasOfficialWebsite: 0,
        hasCutoffs: 0,
        hasFees: 0,
        hasPlacements: 0,
        hasSeats: 0,
        hasCourses: 0,
        hasNIRF: 0,
        hasCore: 0
    };

    const uniqueIds = new Set();

    for (const college of colleges) {
        const id = String(college.id || college._id || college.stableKey);
        uniqueIds.add(id);
        stats.traversedCount++;

        // 1. Address Text
        if (college.location && college.location.trim().length > 0) {
            stats.hasAddressText++;
            stats.hasAddressLink++;
        }

        // 2. Official Website
        if (college.website && college.website.trim().length > 0) {
            stats.hasOfficialWebsite++;
        }

        // 3. Core Status
        if (college.isCore) {
            stats.hasCore++;
        }

        // 4. NIRF Ranking
        const hasVisibleNIRF = Array.isArray(college.rankings) && college.rankings.some(r => {
            const isNirfSource = String(r.source || '').toUpperCase().includes('NIRF');
            const hasRank = r.rank !== undefined && r.rank !== null && r.rank !== '';
            return isNirfSource && hasRank;
        });
        if (hasVisibleNIRF) {
            stats.hasNIRF++;
        }

        // 5. TRUTH SECTIONS (Mirroring React rendering conditions)
        const vfs = vfMap.get(id) || new Set();

        // PLACEMENTS
        const hasIngestedPlacements = college.placements && college.placements.source === 'NIRF 2024';
        if (hasIngestedPlacements || vfs.has('avg_package') || vfs.has('placement_rate')) {
            stats.hasPlacements++;
        }

        // FEES
        const feeVerifiedInDoc = college.fees && college.fees.isVerified;
        if (feeVerifiedInDoc || vfs.has('tuition_fees')) {
            stats.hasFees++;
        }

        // SEATS
        if (vfs.has('student_intake')) {
            stats.hasSeats++;
        }

        // COURSES
        if (Array.isArray(college.courses) && college.courses.length > 0) {
            stats.hasCourses++;
        }

        // CUTOFFS
        if (vfs.has('closingRank')) {
            stats.hasCutoffs++;
        }
    }

    const report = {
        timestamp: new Date().toISOString(),
        denominator: {
            apiTotalCount: total,
            traversedUniqueIds: uniqueIds.size,
            match: total === uniqueIds.size,
            explanation: "Audit performed against MongoDB collection which mirrors UI-visible colleges."
        },
        stats,
        percentages: {}
    };

    Object.keys(stats).forEach(key => {
        if (key !== 'totalColleges' && key !== 'traversedCount') {
            report.percentages[key] = ((stats[key] / total) * 100).toFixed(2) + '%';
        }
    });

    fs.writeFileSync(path.join(__dirname, 'audit_results.json'), JSON.stringify(report, null, 2));
    console.log(`[AUDIT] Final Audit Complete. Traversed ${total} colleges.`);
    
    process.exit(0);
}

runAudit().catch(err => {
    console.error(err);
    process.exit(1);
});
