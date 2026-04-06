const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const College = require('./models/CollegeSchema');

async function audit() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB });
        const patterns = [
            /Indian Institute of Technology/i,
            /National Institute of Technology/i,
            /Indian Institute of Management/i,
            /All India Institute of Medical Sciences/i,
            /Indian Institute of Information Technology/i,
            /BITS Pilani/i,
            /IISc/i,
            /AIIMS/i
        ];
        
        const elite = await College.find({
            $or: patterns.map(p => ({ name: { $regex: p } }))
        }).lean();

        const report = elite.map(c => ({
            name: c.name,
            id: c.id,
            fees: !!c.fees,
            placements: !!c.placements,
            cutoffs: (c.engineeringCutoffs?.length || 0),
            seats: !!c.totalSeats,
            website: c.website
        }));

        console.log(JSON.stringify(report, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

audit();
