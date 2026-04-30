const { MongoClient } = require('mongodb');

async function findIds() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    
    const targets = [
        'AIIMS Delhi', 'Maulana Azad Medical College', 'Vardhman Mahavir', 
        'AIIMS Jodhpur', 'B.J. Medical College', 'Madras Medical College', 
        'King George', 'Seth G.S.', 'Grant Medical College', 'Armed Forces Medical College'
    ];

    const dbs = ['cei_v2', 'cei_legacy'];
    const cols = ['institutions', 'colleges'];

    for (const name of targets) {
        let found = false;
        for (const dbName of dbs) {
            const db = client.db(dbName);
            for (const colName of cols) {
                const inst = await db.collection(colName).findOne({ 
                    $or: [
                        { institution_name: { $regex: name, $options: 'i' } },
                        { name: { $regex: name, $options: 'i' } }
                    ]
                });
                if (inst) {
                    console.log(`${name}: ${inst.institution_id || inst.id || inst._id} (in ${dbName}.${colName})`);
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
        if (!found) console.log(`${name}: NOT FOUND`);
    }
    await client.close();
}

findIds();
