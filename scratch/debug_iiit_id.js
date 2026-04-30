const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://127.0.0.1:27017');
    try {
        await client.connect();
        const db = client.db('cei_v2');
        
        console.log("Searching engineering_cutoffs for IIIT Lucknow...");
        const cutoff = await db.collection('engineering_cutoffs').findOne({ 
            institution_id: { $regex: 'IIIT-LUCKNOW', $options: 'i' } 
        });
        console.log("Cutoff Record:", JSON.stringify(cutoff, null, 2));

        if (cutoff) {
            console.log("\nSearching institutions for corresponding ID...");
            const inst = await db.collection('institutions').findOne({ 
                id: cutoff.institution_id 
            });
            console.log("Institution Record:", JSON.stringify(inst, null, 2));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

main();
