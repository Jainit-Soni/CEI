const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'cei_v2';
const COLLECTION_NAME = 'engineering_cutoffs';

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();

  try {
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const cursor = collection.find({ stable_import_key: null });

    let scanned = 0;
    let updated = 0;
    let skipped = 0;
    const samples = [];

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      scanned += 1;

      const derived = !isBlank(doc?.entity_key) ? String(doc.entity_key).trim() : '';

      if (isBlank(derived)) {
        skipped += 1;
        if (samples.length < 10) {
          samples.push({
            _id: String(doc._id),
            authority: doc.authority || null,
            entity_key: doc.entity_key || null,
            reason: 'missing_entity_key_cannot_backfill'
          });
        }
        continue;
      }

      const res = await collection.updateOne(
        { _id: doc._id, stable_import_key: null },
        { $set: { stable_import_key: derived } }
      );

      updated += res.modifiedCount || 0;

      if (samples.length < 10) {
        samples.push({
          _id: String(doc._id),
          authority: doc.authority || null,
          entity_key: doc.entity_key || null,
          stable_import_key_set_to: derived
        });
      }
    }

    console.log('\nENGINEERING_CUTOFFS STABLE_IMPORT_KEY BACKFILL COMPLETE');
    console.log('Mongo URI                    :', MONGO_URI);
    console.log('Database                     :', DB_NAME);
    console.log('Collection                   :', COLLECTION_NAME);
    console.log('Docs scanned                 :', scanned);
    console.log('Docs updated                 :', updated);
    console.log('Docs skipped                 :', skipped);
    console.log('Sample docs                  :');
    console.log(JSON.stringify(samples, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('BACKFILL FAILED:', err);
  process.exit(1);
});