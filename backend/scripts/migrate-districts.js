const mongoose = require('mongoose');

const MONGODB_URI = "mongodb://JAINIT:Uu4mAS9IQ7Q9NEX4@ac-jmm94uu-shard-00-00.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-01.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-02.shlqnzg.mongodb.net:27017/cei?ssl=true&authSource=admin&retryWrites=true";

async function migrate() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        const coll = mongoose.connection.db.collection('colleges');

        console.log("Fetching colleges missing meta.district...");
        const colleges = await coll.find({
            $or: [
                { 'meta.district': { $exists: false } },
                { 'meta.district': null },
                { 'meta.district': "" }
            ],
            location: { $exists: true, $ne: "" }
        }).toArray();

        console.log(`Found ${colleges.length} colleges to update.`);

        let updated = 0;
        for (const doc of colleges) {
            const parts = doc.location.split(',').map(p => p.trim());
            if (parts.length >= 2) {
                const district = parts[parts.length - 2].replace(/ District$/i, '');

                await coll.updateOne(
                    { _id: doc._id },
                    { $set: { 'meta.district': district } }
                );
                updated++;
                if (updated % 500 === 0) console.log(`Updated ${updated} colleges...`);
            }
        }

        console.log(`Migration successful. Total updated: ${updated}`);
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await mongoose.disconnect();
    }
}

migrate();
