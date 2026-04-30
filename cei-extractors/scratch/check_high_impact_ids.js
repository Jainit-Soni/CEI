const { MongoClient } = require('mongodb');
async function test() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');
    const colleges = [
        'AIIMS Gorakhpur', 'AIIMS Bhubaneswar', 'AIIMS Bibinagar', 'AIIMS Jodhpur', 'AIIMS Patna', 
        'AIIMS Raipur', 'AIIMS Rishikesh', 'AIIMS Nagpur', 'AIIMS Mangalagiri',
        'Maulana Azad Medical College', 'Vardhman Mahavir Medical College', 'Lady Hardinge Medical College',
        'University College of Medical Sciences', 'King George', 'B.J. Medical College'
    ];
    for (const c of colleges) {
        const inst = await db.collection('institutions').findOne({ institution_name: { $regex: c, $options: 'i' } });
        console.log(`${c}: ${inst ? inst.institution_id : 'NOT FOUND'}`);
    }
    await client.close();
}
test();
