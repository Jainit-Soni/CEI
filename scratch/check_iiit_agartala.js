const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://127.0.0.1:27017');
    try {
        await client.connect();
        const db = client.db('cei_v2');
        
        console.log("Searching institutions for 'CORE-IIIT-AGARTALA'...");
        const inst = await db.collection('institutions').findOne({ 
            id: 'CORE-IIIT-AGARTALA' 
        });
        console.log("Institution Record:", JSON.stringify(inst, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

main();
