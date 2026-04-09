require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function run() {
    await connectDB();
    
    console.log("🚀 Starting Ultimate Database Audit...\n");

    const total = await College.countDocuments({});
    
    // 1. Coverage Metrics
    const metrics = {
        total,
        isCore: await College.countDocuments({ isCore: true }),
        fees: await College.countDocuments({ 
            $or: [
                { 'fees.totalNumeric': { $gt: 0 } },
                { 'fees.tuition': { $exists: true, $ne: null } }
            ]
        }),
        placements: await College.countDocuments({ 
            $or: [
                { 'placements.averagePackageNumeric': { $gt: 0 } },
                { 'placements.highestPackageNumeric': { $gt: 0 } }
            ]
        }),
        rankings: await College.countDocuments({ 
            $or: [
                { 'rankings.0': { $exists: true } },
                { 'nirfRank': { $gt: 0, $ne: null } }
            ]
        }),
        cutoffs: await College.countDocuments({ 
            $or: [
                { 'engineeringCutoffs.0': { $exists: true } },
                { 'cutoffs.0': { $exists: true } }
            ]
        }),
        seats: await College.countDocuments({ 
            $or: [
                { 'totalSeats': { $gt: 0 } },
                { 'seats.0': { $exists: true } }
            ]
        }),
        courses: await College.countDocuments({ 
            'courses.0': { $exists: true } 
        }),
        websites: await College.countDocuments({ 
            website: { $exists: true, $ne: null, $ne: "", $not: /pending/i } 
        }),
        established: await College.countDocuments({ 
            established: { $exists: true, $ne: null, $ne: "" } 
        })
    };

    // 2. State-wise Breakdown
    const stateBreakdown = await College.aggregate([
        { $group: { _id: "$state", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);

    // 3. Duplicate Analysis (by AISHE Code)
    const duplicatesAISHE = await College.aggregate([
        { $match: { aisheCode: { $exists: true, $ne: null, $ne: "" } } },
        { $group: { _id: "$aisheCode", count: { $sum: 1 }, ids: { $push: "$id" } } },
        { $match: { count: { $gt: 1 } } }
    ]);

    // 4. Elite Institution Audit (Sampling)
    const elitePatterns = [
        /Indian Institute of Technology/i,
        /National Institute of Technology/i,
        /Indian Institute of Management/i
    ];
    const eliteSummary = await College.find({
        $or: elitePatterns.map(p => ({ name: { $regex: p } }))
    }).select('name state isCore placements fees rankings').limit(20);

    // 5. Placeholder Audit
    const placeholders = await College.countDocuments({
        $or: [
            { name: /TBD/i },
            { name: /Test/i },
            { website: /placeholder/i }
        ]
    });

    const report = {
        timestamp: new Date().toISOString(),
        global_summary: metrics,
        coverage_percentages: Object.fromEntries(
            Object.entries(metrics).map(([k, v]) => [k, ((v / total) * 100).toFixed(2) + '%'])
        ),
        state_distribution: stateBreakdown,
        duplicate_aishe_count: duplicatesAISHE.length,
        placeholder_records: placeholders,
        elite_sample: eliteSummary.map(e => ({
            name: e.name,
            isCore: e.isCore,
            hasPlacements: !!(e.placements?.averagePackageNumeric),
            hasFees: !!(e.fees?.totalNumeric)
        }))
    };

    console.log("--- AUDIT REPORT SUMMARY ---");
    console.log(`Total Colleges: ${total}`);
    console.log(`Core Elite: ${metrics.isCore} (${report.coverage_percentages.isCore})`);
    console.log(`Placements: ${metrics.placements} (${report.coverage_percentages.placements})`);
    console.log(`Rankings: ${metrics.rankings} (${report.coverage_percentages.rankings})`);
    console.log(`Duplicate AISHE Codes: ${duplicatesAISHE.length}`);
    console.log(`Placeholders/Test Records: ${placeholders}`);
    
    const fs = require('fs');
    fs.writeFileSync('audit_report_full.json', JSON.stringify(report, null, 2));
    console.log("\n✅ Full report saved to audit_report_full.json");

    mongoose.connection.close();
}

run().catch(err => {
    console.error("Audit failed:", err);
    process.exit(1);
});
