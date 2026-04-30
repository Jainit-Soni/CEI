const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env.local') });

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        const violations = db.collection('identity_violations');
        
        const res = await violations.updateOne(
            { normalized_name: 'IIITMEDUCATIONINDIA' }, 
            { $set: { approval_score: 85, frequency: 12, source_types: ['josaa'] } }
        );
        
        console.log(`Updated ${res.matchedCount} violation(s) for simulation.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
