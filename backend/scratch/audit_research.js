const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function getStats() {
    try {
        console.log("Connecting to MongoDB...");
        const uri = process.env.MONGODB_URI;
        const dbName = process.env.MONGODB_DB || 'cei_v2';
        
        await mongoose.connect(uri, { dbName });
        const db = mongoose.connection.db;
        console.log(`Connected to DB: ${db.databaseName}`);
        
        const collections = await db.listCollections().toArray();
        console.log("All Collections in DB:", collections.map(c => c.name));
        const report = {
            collections: {},
            institutional_coverage: {},
            metadata_linkage: {}
        };
        
        console.log(`Found ${collections.length} collections.`);
        
        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            report.collections[col.name] = count;
        }

        const institutions = db.collection('institutions');
        
        // 1. Core vs Non-Core
        const total = await institutions.countDocuments();
        const coreCount = await institutions.countDocuments({ isCore: true });
        report.institutional_coverage.total = total;
        report.institutional_coverage.core = coreCount;
        report.institutional_coverage.non_core = total - coreCount;

        // 2. Linking analysis
        console.log("Analyzing linkage...");
        const withCutoffs = await db.collection('engineering_cutoffs').distinct('institute_name_normalized');
        const withSeats = await db.collection('seat_matrix').distinct('institute_name_normalized');
        const withCourses = await db.collection('course_offerings').distinct('institute_name_raw'); 

        report.metadata_linkage.unique_inst_in_cutoffs = withCutoffs.length;
        report.metadata_linkage.unique_inst_in_seats = withSeats.length;
        report.metadata_linkage.unique_inst_in_courses = withCourses.length;

        // 3. Metadata Coverage in Institutions collection
        const withPlacements = await institutions.countDocuments({ "placements.averagePackageNumeric": { $exists: true, $ne: null } });
        const withFees = await institutions.countDocuments({ "fees.totalNumeric": { $exists: true, $ne: null } });
        const withRankings = await institutions.countDocuments({ rankings: { $exists: true, $not: { $size: 0 } } });

        report.metadata_linkage.placements_direct = withPlacements;
        report.metadata_linkage.fees_direct = withFees;
        report.metadata_linkage.rankings_direct = withRankings;

        console.log("\n--- Audit Report ---");
        console.log(JSON.stringify(report, null, 2));


        if (report['engineering_cutoffs']) {
            const sampleCutoff = await db.collection('engineering_cutoffs').findOne({});
            console.log("\n--- Sample Engineering Cutoff ---");
            console.log(JSON.stringify(sampleCutoff, null, 2));
        }

        if (report.collections.institutions) {
            const clean = await institutions.findOne({ id: { $exists: true }, name: { $exists: true } });
            console.log("\n--- Sample Clean Institution ---");
            console.log(JSON.stringify(clean, null, 2));

            const iit = await institutions.findOne({ $or: [{name: /Bombay|Bhubaneswar/i}, {institution_name: /Bombay|Bhubaneswar/i}] });
            console.log("\n--- Sample IIT Found ---");
            console.log(JSON.stringify(iit, null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

getStats();
