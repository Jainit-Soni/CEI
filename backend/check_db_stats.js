const mongoose = require('mongoose');
require('dotenv').config({ path: './.env.local' });


async function checkCoverage() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log('--- 🛡️  COVERAGE DISTRIBUTION ---');
    const result = await db.collection('institutions').aggregate([
        { $group: { _id: '$coverage.coverageBucket', count: { $sum: 1 } } }
    ]).toArray();
    console.log(JSON.stringify(result, null, 2));

    console.log('\n--- 🛡️  AUTHORITY DISTRIBUTION ---');
    const auth = await db.collection('institutions').aggregate([
        { $group: { _id: '$authority', count: { $sum: 1 } } }
    ]).toArray();
    console.log(JSON.stringify(auth, null, 2));

    console.log('\n--- 🛡️  JoSAA + Rich TIER DISTRIBUTION ---');
    const josaaRichTiers = await db.collection('institutions').aggregate([
        { $match: { authority: 'JoSAA', 'coverage.coverageBucket': 'Rich' } },
        { $group: { _id: '$rankingTier', count: { $sum: 1 } } }
    ]).toArray();
    console.log(JSON.stringify(josaaRichTiers, null, 2));

    mongoose.connection.close();
}


checkCoverage().catch(console.error);
