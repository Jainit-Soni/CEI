const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
if (!process.env.MONGODB_URI && fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
}

// Define College Schema
const collegeSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    name: String,
    ceiScore: Number,
    competitivenessBand: String,
    lastScoreUpdate: { type: Date, default: Date.now }
}, { strict: false });

const College = mongoose.model('College', collegeSchema, 'colleges');

async function syncScores() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected.");

    // First, let's load all colleges in DB to map them by name
    console.log("Fetching existing colleges to build name index...");
    const existingColleges = await College.find({}, { name: 1, id: 1 }).lean();
    const nameMap = new Map();
    existingColleges.forEach(c => {
        if (c.name) {
            // make a sanitized key
            const key = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            nameMap.set(key, c.id);
        }
    });
    console.log(`Loaded ${existingColleges.length} colleges into memory index.`);

    const csvPath = path.join(__dirname, '../output/scoring/master_scored_institutions.csv');
    console.log(`Reading ${csvPath}...`);

    let updates = 0;
    const bulkOps = [];

    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
            if (!row.institution_name || !row.cei_score) return;

            const sanitizedSearchName = row.institution_name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const matchingId = nameMap.get(sanitizedSearchName);

            if (matchingId) {
                bulkOps.push({
                    updateOne: {
                        filter: { id: matchingId },
                        update: {
                            $set: {
                                ceiScore: parseFloat(parseFloat(row.cei_score).toFixed(2)),
                                competitivenessBand: row.competitiveness_band,
                                lastScoreUpdate: new Date()
                            }
                        }
                    }
                });
            }
        })
        .on('end', async () => {
            console.log(`Matched ${bulkOps.length} records via exact name mapping. Executing bulk write...`);

            // Chunking
            const chunkSize = 500;
            for (let i = 0; i < bulkOps.length; i += chunkSize) {
                const chunk = bulkOps.slice(i, i + chunkSize);
                try {
                    const result = await College.bulkWrite(chunk, { ordered: false });
                    updates += result.modifiedCount;
                    console.log(`Processed chunk ${Math.floor(i / chunkSize) + 1}. Updated so far: ${updates}`);
                } catch (e) {
                    console.error("Bulk write error:", e.message);
                }
            }

            console.log(`✅ Synchronization complete. Total Documents Updated: ${updates}`);
            process.exit(0);
        });
}

syncScores().catch(console.error);
