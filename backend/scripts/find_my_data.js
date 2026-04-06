const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

async function findData() {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/";
    const client = new MongoClient(uri);
    await client.connect();
    
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    
    console.log("📂 SCANNING ALL DATABASES FOR 'MUCH MORE' DATA:");
    for (const dbInfo of dbs.databases) {
        const dbName = dbInfo.name;
        const db = client.db(dbName);
        const collections = await db.listCollections().toArray();
        for (const coll of collections) {
            const count = await db.collection(coll.name).countDocuments({});
            if (count > 1000) {
                console.log(`✨ FOUND DATA in [${dbName}] -> ${coll.name}: ${count.toLocaleString()} docs`);
            }
        }
    }

    await client.close();
}

findData().catch(console.error);
