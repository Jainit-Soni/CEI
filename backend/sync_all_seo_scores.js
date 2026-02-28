const mongoose = require('mongoose');

const uri = "mongodb://JAINIT:Uu4mAS9IQ7Q9NEX4@ac-jmm94uu-shard-00-00.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-01.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-02.shlqnzg.mongodb.net:27017/cei?ssl=true&authSource=admin&retryWrites=true";

mongoose.connect(uri)
    .then(async () => {
        const db = mongoose.connection.db;

        console.log("Fetching scored canonical records...");
        // Only get name, ceiScore, competitivenessBand
        const scoredColleges = await db.collection('colleges').find({ ceiScore: { $exists: true } }).project({ name: 1, ceiScore: 1, competitivenessBand: 1 }).toArray();

        console.log(`Found ${scoredColleges.length} scored records. Syncing to unscored SEO duplicates safely...`);
        let bulkOps = [];
        let modifiedCount = 0;

        for (let c of scoredColleges) {
            if (!c.name) continue;

            // Strip out commas, extra spaces to match the SEO names flawlessly
            const cleanName = c.name.replace(/,/g, '').replace(/\s+/g, ' ').trim();
            const regexStr = `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;

            bulkOps.push({
                updateMany: {
                    // Find records that don't have a CEI score yet but share the exact clean name
                    filter: {
                        ceiScore: { $exists: false },
                        name: { $regex: new RegExp(regexStr, 'i') }
                    },
                    update: {
                        $set: {
                            ceiScore: c.ceiScore,
                            competitivenessBand: c.competitivenessBand,
                            verificationStatus: 'Synced from Canonical',
                            lastScoreUpdate: new Date()
                        }
                    }
                }
            });

            // process in batches of 1000 to avoid memory/network issues
            if (bulkOps.length >= 1000) {
                const res = await db.collection('colleges').bulkWrite(bulkOps);
                modifiedCount += res.modifiedCount;
                bulkOps = [];
                console.log(`Synced ${modifiedCount} SEO records so far...`);
            }
        }

        if (bulkOps.length > 0) {
            const res = await db.collection('colleges').bulkWrite(bulkOps);
            modifiedCount += res.modifiedCount;
        }

        console.log(`Successfully synced a total of ${modifiedCount} SEO records with canonical scores!`);

        process.exit(0);
    });
