const { MongoClient } = require('mongodb');
async function test() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const list = await client.db('cei_v2').collection('institutions').find({ 
        institution_name: /All India Institute|Vardhman Mahavir|Maulana Azad|Lady Hardinge|King George|Medical College|JIPMER/i 
    }).toArray();
    list.forEach(l => {
        console.log(`${l.institution_name} || ${l.institution_id}`);
    });
    await client.close();
}
test();
