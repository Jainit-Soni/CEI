const { MongoClient } = require('mongodb');
const path = require('path');

async function run() {
    require('dotenv').config({ path: path.join(__dirname, '../../../backend/.env.local') });
    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
    try {
        await client.connect();
        const db = client.db('cei_v2');
        const hasName = await db.collection('institutions').countDocuments({ name: { $exists: true } });
        const hasLocation = await db.collection('institutions').countDocuments({ location: { $exists: true } });
        const hasAddress = await db.collection('institutions').countDocuments({ address: { $exists: true } });
        const hasInstName = await db.collection('institutions').countDocuments({ institution_name: { $exists: true } });
        
        console.log({ hasName, hasLocation, hasAddress, hasInstName });
    } finally {
        await client.close();
    }
}
run();
