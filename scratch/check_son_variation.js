const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://127.0.0.1:27017');
    try {
        await client.connect();
        const db = client.db('cei_v2');
        const docs = await db.collection('engineering_cutoffs').distinct('institution_id', { 
            institution_id: { $regex: 'SON', $options: 'i' } 
        });
        console.log('IDs containing SON:', docs);
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

main();
