require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const connectDB = require('../config/db');
const College = require('../models/CollegeSchema');

const dataDir = path.join(__dirname, '../data');
const filesToProcess = [
    { file: 'aishe_colleges.csv', tier: 'Tier 3' },
    { file: 'aishe_standalone.csv', tier: 'Stand Alone' },
    { file: 'aishe_university.csv', tier: 'University' }
];

let existingCollegesMap = new Set();

const loadExistingColleges = async () => {
    console.log('Loading existing colleges into RAM for ultra-fast deduplication...');
    // We fetch only names and states to save RAM
    const colleges = await College.find({}, { name: 1, state: 1 }).lean();
    colleges.forEach(c => {
        if (c.name && c.state) {
            existingCollegesMap.add(`${c.name.trim().toLowerCase()}|${c.state.trim().toLowerCase()}`);
        }
    });
    console.log(`Loaded ${colleges.length} existing records into Deduplication Engine.\n`);
};

const processCSV = (filePath, defaultTier) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ Skipping missing file: ${filePath}`);
            return resolve();
        }

        console.log(`⏳ Parsing ${path.basename(filePath)} as ${defaultTier}...`);

        const docsToInsert = [];

        fs.createReadStream(filePath)
            .pipe(csv({ skipLines: 2 }))
            .on('data', (row) => {
                const normalizedRow = {};
                for (let key in row) {
                    normalizedRow[key.toLowerCase().trim().replace(/ /g, '_')] = row[key];
                }

                const aisheId = normalizedRow['aishe_code'] || `aishe_${Date.now()}_${Math.random()}`;
                const name = normalizedRow['name'];
                const state = normalizedRow['state'];
                const district = normalizedRow['district'];
                const website = normalizedRow['website'];
                const year = normalizedRow['year_of_establishment'];

                if (!name || !state) return;

                const dedupKey = `${name.trim().toLowerCase()}|${state.trim().toLowerCase()}`;

                // Extremely fast O(1) Ram Lookup instead of relying on Index-less MongoDB regex bulk upserts
                if (existingCollegesMap.has(dedupKey)) {
                    return; // Skip, we already have this college!
                }

                // Add to our set so we don't insert duplicates within the same CSV or across CSVs
                existingCollegesMap.add(dedupKey);

                const collegeShell = {
                    id: aisheId,
                    name: name.trim(),
                    state: state.trim(),
                    rankingTier: defaultTier,
                    isPremium: false,
                    aisheCode: aisheId,
                    officialUrl: website ? website.trim() : '',
                    meta: {
                        district: district ? district.trim() : 'Unknown',
                        establishedYear: year ? year.trim() : '',
                        sourceType: ['AISHE Directory']
                    },
                    courses: [],
                    pastCutoffs: [],
                    acceptedExams: [],
                    topRecruiters: [],
                    sources: ['Government AISHE Survey']
                };

                docsToInsert.push(collegeShell);
            })
            .on('end', async () => {
                console.log(`Matched ${docsToInsert.length} NEW unique records in ${path.basename(filePath)}.`);

                if (docsToInsert.length === 0) {
                    return resolve();
                }

                try {
                    const chunkSize = 5000;
                    let insertedCount = 0;

                    for (let i = 0; i < docsToInsert.length; i += chunkSize) {
                        const chunk = docsToInsert.slice(i, i + chunkSize);
                        try {
                            const result = await College.insertMany(chunk, { ordered: false });
                            insertedCount += result.length;
                        } catch (err) {
                            if (err.code === 11000) {
                                insertedCount += err.insertedDocs ? err.insertedDocs.length : 0;
                            }
                        }
                        process.stdout.write(`\rProgress: Inserted chunk of ${chunk.length} | Total Inserted: ${insertedCount}`);
                    }
                    console.log(`\n✅ Completed mapping & inserting for ${path.basename(filePath)}!\n`);
                    resolve();
                } catch (err) {
                    console.error('❌ Error during mass insert:', err.message);
                    reject(err);
                }
            })
            .on('error', (error) => {
                reject(error);
            });
    });
};

const ingestAisheData = async () => {
    await connectDB();
    console.log('Starting ultra-fast ingestion of AISHE Datasets...');

    try {
        await loadExistingColleges();

        for (const fileObj of filesToProcess) {
            const filePath = path.join(dataDir, fileObj.file);
            await processCSV(filePath, fileObj.tier);
        }

        const finalCount = await College.countDocuments();
        console.log(`🎉 MASS INGESTION COMPLETE!`);
        console.log(`Total Colleges in Database globally: ${finalCount}`);

    } catch (err) {
        console.error("Fatal Pipeline Error:", err);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
};

ingestAisheData();
