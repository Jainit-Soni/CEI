require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function run() {
    await connectDB();
    
    const total = await College.countDocuments({});
    
    // Individual metadata field counts
    // Note: We check for existence and non-null/non-empty values
    const stats = {
        total,
        cutoffs: await College.countDocuments({ 
            $or: [
                { 'engineeringCutoffs.0': { $exists: true } },
                { 'cutoffs.0': { $exists: true } }
            ]
        }),
        seats: await College.countDocuments({ 
            $or: [
                { 'seats.0': { $exists: true } },
                { 'totalSeats': { $exists: true, $ne: null } }
            ]
        }),
        fees: await College.countDocuments({ 
            $or: [
                { 'fees.totalNumeric': { $gt: 0 } },
                { 'tuition': { $exists: true, $ne: null } }
            ]
        }),
        placements: await College.countDocuments({ 
            $or: [
                { 'placements.averagePackageNumeric': { $gt: 0 } },
                { 'placements.averagePackage': { $exists: true, $ne: null } }
            ]
        }),
        rankings: await College.countDocuments({ 
            $or: [
                { 'rankings.0': { $exists: true } },
                { 'nirfRank': { $gt: 0 } }
            ]
        }),
        courses: await College.countDocuments({ 
            'courses.0': { $exists: true } 
        }),
        websites: await College.countDocuments({ 
            website: { $exists: true, $ne: null, $ne: "" } 
        })
    };

    console.log("--- FINAL DB COVERAGE ANALYTICS ---");
    console.log(JSON.stringify(stats, null, 2));
    
    mongoose.connection.close();
}

run().catch(console.error);
