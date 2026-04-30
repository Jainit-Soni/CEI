const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

async function fix() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected.");
    
    const collection = mongoose.connection.db.collection('medicalcutoffs');
    
    // Find all documents
    const docs = await collection.find({}).toArray();
    console.log(`Analyzing ${docs.length} documents...`);
    
    let updated = 0;
    for (const doc of docs) {
        const program_type = doc.medical_entity_id.endsWith('-MBBS') ? 'MBBS' : 'BDS';
        await collection.updateOne({ _id: doc._id }, { $set: { program_type } });
        updated++;
    }
    
    console.log(`Done. Updated ${updated} documents.`);
    process.exit(0);
}

fix();
