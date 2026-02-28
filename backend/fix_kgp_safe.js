const mongoose = require('mongoose');

const uri = "mongodb://JAINIT:Uu4mAS9IQ7Q9NEX4@ac-jmm94uu-shard-00-00.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-01.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-02.shlqnzg.mongodb.net:27017/cei?ssl=true&authSource=admin&retryWrites=true";

mongoose.connect(uri)
    .then(async () => {
        const db = mongoose.connection.db;

        // Sync IIT Kharagpur
        const kgpCanonical = await db.collection('colleges').findOne({ id: 'U-0573' });
        if (kgpCanonical && kgpCanonical.ceiScore) {
            await db.collection('colleges').updateMany({ id: 'iit-kharagpur' }, {
                $set: {
                    ceiScore: kgpCanonical.ceiScore,
                    competitivenessBand: kgpCanonical.competitivenessBand,
                    verificationStatus: 'Synced from Canonical',
                    lastScoreUpdate: new Date()
                }
            });
            console.log('Updated iit-kharagpur CEI SCORE TO:', kgpCanonical.ceiScore);
        }

        // Check if others like IIT Bombay need syncing
        const bombay = await db.collection('colleges').findOne({ id: 'U-0306' });
        if (bombay && bombay.ceiScore) {
            await db.collection('colleges').updateMany({ id: 'iit-bombay' }, {
                $set: { ceiScore: bombay.ceiScore, competitivenessBand: bombay.competitivenessBand }
            });
            console.log('Updated iit-bombay CEI SCORE TO:', bombay.ceiScore);
        }

        // Check IIT Delhi
        const delhi = await db.collection('colleges').findOne({ id: 'U-0100' });
        if (delhi && delhi.ceiScore) {
            await db.collection('colleges').updateMany({ id: 'iit-delhi' }, {
                $set: { ceiScore: delhi.ceiScore, competitivenessBand: delhi.competitivenessBand }
            });
            console.log('Updated iit-delhi CEI SCORE TO:', delhi.ceiScore);
        }

        process.exit(0);
    });
