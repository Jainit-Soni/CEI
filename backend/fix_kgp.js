const mongoose = require('mongoose');

const uri = "mongodb://JAINIT:Uu4mAS9IQ7Q9NEX4@ac-jmm94uu-shard-00-00.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-01.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-02.shlqnzg.mongodb.net:27017/cei?ssl=true&authSource=admin&retryWrites=true";

mongoose.connect(uri)
    .then(async () => {
        const db = mongoose.connection.db;

        // Hardcode syncs for the major SEO IITs directly
        const kgpCanonical = await db.collection('colleges').findOne({ id: 'U-0573' });
        if (kgpCanonical && kgpCanonical.ceiScore) {
            await db.collection('colleges').updateMany({ id: 'iit-kharagpur' }, {
                $set: {
                    ceiScore: kgpCanonical.ceiScore,
                    competitivenessBand: kgpCanonical.competitivenessBand,
                    canonicalId: kgpCanonical.canonicalId,
                    verificationStatus: 'Synced from Canonical',
                    lastScoreUpdate: new Date()
                }
            });
            console.log('Updated IIT KGP SCORE TO:', kgpCanonical.ceiScore);
        }

        process.exit(0);
    });
