const { MongoClient } = require('mongodb');
async function test() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');
    const colleges = [
        { id: 'CORE-AIIMS-DELHI', name: 'AIIMS Delhi' },
        { id: 'CORE-MAMC-DELHI', name: 'MAMC Delhi' },
        { id: 'CORE-VMMC-DELHI', name: 'VMMC Delhi' },
        { id: 'CORE-LHMC-DELHI', name: 'LHMC Delhi' }
    ];
    for (const c of colleges) {
        console.log(`\n--- ${c.name} ---`);
        const cutoff = await db.collection('medical_cutoffs').findOne({ institution_id: c.id, round: 'ROUND_I', course_canonical: 'MBBS', category_canonical: 'OPEN' });
        console.log(`Cutoff R1 Open: ${cutoff ? cutoff.closing_rank : 'NOT FOUND'}`);
        const seats = await db.collection('medical_seat_matrix').find({ institution_id: c.id }).toArray();
        console.log(`Seats Found: ${seats.length}`);
    }
    await client.close();
}
test();
