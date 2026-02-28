const mongoose = require('mongoose');

const uri = "mongodb://JAINIT:Uu4mAS9IQ7Q9NEX4@ac-jmm94uu-shard-00-00.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-01.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-02.shlqnzg.mongodb.net:27017/cei?ssl=true&authSource=admin&retryWrites=true";

mongoose.connect(uri)
    .then(async () => {
        const db = mongoose.connection.db;

        console.log("Fetching scored canonical records (e.g., U-0573)...");
        const scoredColleges = await db.collection('colleges').find({ ceiScore: { $exists: true } }).toArray();

        console.log(`Found ${scoredColleges.length} scored records. Syncing to unscored SEO duplicates...`);
        const bulkOps = [];

        for (let c of scoredColleges) {
            // Strip out commas, extra spaces, and "The" to match duplicates
            const cleanName = c.name.replace(/,/g, '').replace(/\s+/g, ' ').trim();

            // Find unscored records with a matching name
            const unscoredMatches = await db.collection('colleges').find({
                ceiScore: { $exists: false },
                name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            }).toArray();

            if (unscoredMatches.length > 0) {
                for (let match of unscoredMatches) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: match._id },
                            update: {
                                $set: {
                                    ceiScore: c.ceiScore,
                                    competitivenessBand: c.competitivenessBand,
                                    canonicalId: c.canonicalId || c.id,
                                    verificationStatus: 'Synced from Canonical',
                                    lastScoreUpdate: new Date()
                                }
                            }
                        }
                    });
                }
            }
        }

        if (bulkOps.length > 0) {
            console.log(`Executing ${bulkOps.length} cross-sync updates...`);
            const res = await db.collection('colleges').bulkWrite(bulkOps);
            console.log(`Successfully synced ${res.modifiedCount} SEO records with canonical scores!`);
        } else {
            console.log("No unscored duplicates found that required syncing.");
        }

        process.exit(0);
    });
