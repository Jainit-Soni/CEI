const { MongoClient } = require('mongodb');
async function test() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const inst = await client.db('cei_v2').collection('institutions').findOne({ institution_name: /All India Institute of Medical Sciences/i });
    console.log(JSON.stringify(inst, null, 2));
    await client.close();
}
test();
