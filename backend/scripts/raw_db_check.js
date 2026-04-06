const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

async function check() {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/";
    const client = new MongoClient(uri);
    await client.connect();
    console.log("✅ Connected to MongoDB");
    
    const db = client.db(process.env.MONGODB_DB || "cei_v2");
    const collections = await db.listCollections().toArray();
    console.log("\n📊 COLLECTIONS IN DB:");
    for (const coll of collections) {
        const count = await db.collection(coll.name).countDocuments({});
        console.log(`- ${coll.name.padEnd(20)}: ${count.toLocaleString()} docs`);
    }
    
    // Check for specific fields in 'colleges'
    if (collections.find(c => c.name === 'colleges')) {
        const withWebsite = await db.collection('colleges').countDocuments({ website: { $exists: true, $ne: null } });
        const withCourses = await db.collection('colleges').countDocuments({ 'courses.0': { $exists: true } });
        console.log(`\n🔍 Metadata Check (colleges):`);
        console.log(`- Websites: ${withWebsite.toLocaleString()}`);
        console.log(`- Courses : ${withCourses.toLocaleString()}`);
    }

    await client.close();
}

check().catch(console.error);
