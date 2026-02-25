require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/db');
const College = require('../models/CollegeSchema');

const modelsDir = path.join(__dirname, '../models');

const migrateData = async () => {
    await connectDB();

    try {
        // 1. Get all State JSON files
        const files = fs.readdirSync(modelsDir)
            .filter(file => file.endsWith('_Colleges.json') && !file.includes('Tier2'));

        let totalInserted = 0;
        let totalFailed = 0;

        // 2. Clear existing collection (optional, uncomment if doing a fresh run)
        // await College.deleteMany({});
        // console.log('Cleared existing College collection.');

        for (const file of files) {
            console.log(`Processing ${file}...`);
            const filePath = path.join(modelsDir, file);
            const rawData = fs.readFileSync(filePath, 'utf-8');
            const cleanedData = rawData.replace(/^\uFEFF/, "");
            let stateColleges = JSON.parse(cleanedData);

            // Determine state from filename (e.g., Delhi_Colleges.json -> Delhi)
            const stateName = file.replace('_Colleges.json', '').replace(/_/g, ' ');

            const collegesToInsert = stateColleges.map(college => ({
                ...college,
                state: stateName,
                isPremium: true // Flagging our hand-curated datastore as Premium
            }));

            try {
                const result = await College.insertMany(collegesToInsert, { ordered: false });
                console.log(`✅ Inserted ${result.length} colleges from ${stateName}`);
                totalInserted += result.length;
            } catch (insertError) {
                // ordered: false allows successful inserts to proceed even if some fail (e.g., duplicates)
                if (insertError.code === 11000) {
                    console.log(`⚠️  Skipped some duplicates in ${stateName}`);
                    totalInserted += insertError.insertedDocs.length;
                    totalFailed += (collegesToInsert.length - insertError.insertedDocs.length);
                } else {
                    console.error(`❌ Error inserting ${stateName}:`, insertError.message);
                }
            }
        }

        console.log('\n--- Migration Summary ---');
        console.log(`Total Successfully Inserted: ${totalInserted}`);
        console.log(`Total Failed/Duplicates: ${totalFailed}`);
        console.log('-------------------------');

    } catch (err) {
        console.error('Fatal Migration Error:', err);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
};

migrateData();
