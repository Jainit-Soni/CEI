const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://127.0.0.1:27017');
    try {
        await client.connect();
        const db = client.db('cei_v2');
        
        console.log("Searching institutions for 'Lucknow' and 'Technology'...");
        const insts = await db.collection('institutions').find({ 
            name: { $all: [/Lucknow/i, /Technology/i] } 
        }).toArray();
        console.log("Results:", insts.map(i => ({ id: i.id, name: i.name })));

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

main();
