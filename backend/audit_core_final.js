const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const College = require('./models/CollegeSchema');

async function audit() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB });
        const core = await College.find({ isCore: true }).lean();
        
        const report = core.map(c => ({
            name: c.name,
            id: c.id,
            fees: !!c.fees,
            placements: !!c.placements,
            cutoffs: (c.engineeringCutoffs?.length || 0),
            seats: !!c.totalSeats,
            website: !!c.website
        }));

        console.log(JSON.stringify(report, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

audit();
