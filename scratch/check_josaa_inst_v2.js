const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://127.0.0.1:27017');
    try {
        await client.connect();
        const db = client.db('cei_v2');
        console.log('Searching josaa_institutes for Lucknow...');
        const docs = await db.collection('josaa_institutes').find({ 
            institute_name_raw: { $regex: 'Lucknow', $options: 'i' } 
        }).toArray();
        console.log('Results:', JSON.stringify(docs, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

main();
