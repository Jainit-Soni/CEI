const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://127.0.0.1:27017');
    try {
        await client.connect();
        const db = client.db('cei_v2');
        
        console.log("Searching institutions for IIIT Lucknow pattern in ID...");
        const insts = await db.collection('institutions').find({ 
            id: { $regex: 'IIIT', $options: 'i' } 
        }).toArray();
        console.log("IIIT results:", insts.map(i => ({ id: i.id, name: i.name })));

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

main();
