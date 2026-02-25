require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI in environment variables.");
    process.exit(1);
}

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
