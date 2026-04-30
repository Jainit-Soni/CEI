const mongoose = require('mongoose');

(async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/cei_v2');
        const db = mongoose.connection.db;

        console.log("--- Collection Probe ---");
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        console.log("Found collections:", collectionNames.join(', '));

        const targetNames = ['Bombay', 'Tiruchirappalli', 'Vadodara', 'AIIMS', 'All India Institute of Medical Sciences'];

        const probeCollection = async (collName) => {
            if (!collectionNames.includes(collName)) return;
            const coll = db.collection(collName);
            const sample = await coll.findOne({});
            if (!sample) {
                console.log(`[${collName}] is empty.`);
                return;
            }
            
            const keys = Object.keys(sample);
            const instKey = keys.find(k => k.toLowerCase().includes('inst') || k.toLowerCase().includes('college'));
            
            console.log(`[${collName}] schema sample keys:`, keys.join(', '));
            
            if (instKey) {
                for (const target of targetNames) {
                    const count = await coll.countDocuments({ [instKey]: new RegExp(target, 'i') });
                    if (count > 0) {
                        console.log(`  -> Found ${count} records matching '${target}' using key '${instKey}'`);
                        const doc = await coll.findOne({ [instKey]: new RegExp(target, 'i') });
                        console.log(`       Sample: ${doc[instKey]}`);
                    }
                }
            } else {
                console.log(`[${collName}] Could not heuristically find institution key.`);
            }
        };

        await probeCollection('engineering_cutoffs');
        await probeCollection('seat_matrix');
        await probeCollection('medical_seat_matrix');
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
