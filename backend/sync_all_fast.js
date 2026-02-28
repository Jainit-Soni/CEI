const mongoose = require('mongoose');

const uri = "mongodb://JAINIT:Uu4mAS9IQ7Q9NEX4@ac-jmm94uu-shard-00-00.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-01.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-02.shlqnzg.mongodb.net:27017/cei?ssl=true&authSource=admin&retryWrites=true";

mongoose.connect(uri)
    .then(async () => {
        const db = mongoose.connection.db;

        console.log("Fetching scored canonical records in memory...");
        const scoredColleges = await db.collection('colleges').find({ ceiScore: { $exists: true } }).project({ name: 1, ceiScore: 1, competitivenessBand: 1 }).toArray();

        const scoreMap = new Map();
        for (let c of scoredColleges) {
            if (!c.name) continue;
            const clean = c.name.replace(/,/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
            scoreMap.set(clean, { score: c.ceiScore, band: c.competitivenessBand });
        }

        console.log(`Loaded ${scoreMap.size} unique scored names. Fetching unscored SEO records...`);

        const unscored = await db.collection('colleges').find({ ceiScore: { $exists: false } }).project({ _id: 1, name: 1 }).toArray();
        console.log(`Found ${unscored.length} unscored records. Analyzing...`);

        let bulkOps = [];
        let modifiedCount = 0;

        for (let u of unscored) {
            if (!u.name) continue;
            const clean = u.name.replace(/,/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

            const match = scoreMap.get(clean);
            if (match) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: u._id },
                        update: {
                            $set: {
                                ceiScore: match.score,
                                competitivenessBand: match.band,
                                verificationStatus: 'Synced from Canonical',
                                lastScoreUpdate: new Date()
                            }
                        }
                    }
                });

                if (bulkOps.length >= 2000) {
                    const res = await db.collection('colleges').bulkWrite(bulkOps);
                    modifiedCount += res.modifiedCount;
                    bulkOps = [];
                }
            }
        }

        if (bulkOps.length > 0) {
            const res = await db.collection('colleges').bulkWrite(bulkOps);
            modifiedCount += res.modifiedCount;
        }

        console.log(`Successfully synced a total of ${modifiedCount} SEO records with canonical scores via memory map!`);

        process.exit(0);
    });
