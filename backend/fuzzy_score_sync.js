const mongoose = require('mongoose');

const uri = "mongodb://JAINIT:Uu4mAS9IQ7Q9NEX4@ac-jmm94uu-shard-00-00.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-01.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-02.shlqnzg.mongodb.net:27017/cei?ssl=true&authSource=admin&retryWrites=true";

mongoose.connect(uri)
    .then(async () => {
        const db = mongoose.connection.db;

        // Manual patches for high-profile naming disparities
        const patches = [
            { canonicalId: 'U-1019', seoId: 'iim-calcutta' }, // IIM Kolkata -> IIM Calcutta
            { canonicalId: 'U-0138', seoId: 'iim-ahm' },      // IIM Ahmedabad
            { canonicalId: 'U-0205', seoId: 'iim-bangalore' },// IIM Bangalore
            { canonicalId: 'U-0490', seoId: 'vellore-institute-of-technology' }, // VIT
            { canonicalId: 'U-0490', seoId: 'vellore-institute-of-technolog-vellore' }, // VIT dup
            { canonicalId: 'U-0504', seoId: 'iit-madras' },
            { canonicalId: 'U-0517', seoId: 'iit-kanpur' },
            { canonicalId: 'U-0560', seoId: 'iit-roorkee' },
            { canonicalId: 'U-0053', seoId: 'iit-guwahati' }
        ];

        for (let patch of patches) {
            const canonical = await db.collection('colleges').findOne({ id: patch.canonicalId });
            if (canonical && canonical.ceiScore) {
                await db.collection('colleges').updateMany({ id: patch.seoId }, {
                    $set: {
                        ceiScore: canonical.ceiScore,
                        competitivenessBand: canonical.competitivenessBand,
                        verificationStatus: 'Semantic Sync from Canonical'
                    }
                });
                console.log(`Patched ${patch.seoId} with score ${canonical.ceiScore}`);
            }
        }

        // Now, let's try a broader fuzzy match for the remaining:
        const unscored = await db.collection('colleges').find({ ceiScore: { $exists: false } }).toArray();
        console.log(`Found ${unscored.length} remaining unscored records... attempting fuzzy matching.`);

        // We fetch all scored records
        const scoredColleges = await db.collection('colleges').find({ ceiScore: { $exists: true } }).project({ name: 1, ceiScore: 1, competitivenessBand: 1 }).toArray();

        let bulkOps = [];

        for (let u of unscored) {
            if (!u.name) continue;

            // Very aggressive normalization: strip everything except alphanumeric
            const cleanSEO = u.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

            let match = null;
            for (let s of scoredColleges) {
                if (!s.name) continue;
                const cleanCanon = s.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                // If they are exactly the same when all punctuation/spaces are removed
                if (cleanSEO === cleanCanon) {
                    match = s;
                    break;
                }
            }

            if (match) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: u._id },
                        update: {
                            $set: {
                                ceiScore: match.ceiScore,
                                competitivenessBand: match.competitivenessBand,
                                verificationStatus: 'Fuzzy Sync from Canonical'
                            }
                        }
                    }
                });
            }
        }

        if (bulkOps.length > 0) {
            const res = await db.collection('colleges').bulkWrite(bulkOps);
            console.log(`Successfully fuzzy synced ${res.modifiedCount} records!`);
        }

        process.exit(0);
    });
