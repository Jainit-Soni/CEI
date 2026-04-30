const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://127.0.0.1:27017');
    try {
        await client.connect();
        const db = client.db('cei_v2');
        
        console.log("Searching institutions for IIIT Lucknow by name...");
        const insts = await db.collection('institutions').find({ 
            name: { $regex: 'Information Technology Lucknow', $options: 'i' } 
        }).toArray();
        console.log("Institutions found:", JSON.stringify(insts, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

main();
