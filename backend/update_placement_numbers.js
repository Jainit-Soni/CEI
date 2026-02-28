const mongoose = require('mongoose');

const uri = "mongodb://JAINIT:Uu4mAS9IQ7Q9NEX4@ac-jmm94uu-shard-00-00.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-01.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-02.shlqnzg.mongodb.net:27017/cei?ssl=true&authSource=admin&retryWrites=true";

mongoose.connect(uri)
    .then(async () => {
        const db = mongoose.connection.db;
        const colleges = await db.collection('colleges').find({ 'placements.highestPackage': { $exists: true, $ne: null } }).toArray();

        const bulkOps = [];

        for (let c of colleges) {
            const hp = c.placements.highestPackage.toUpperCase();
            let match = hp.match(/([\d\.]+)/g);
            if (!match) continue;

            let num = 0;
            // If it's a range like 20-30, take 30
            if (match.length > 1) {
                num = parseFloat(match[1]);
            } else {
                num = parseFloat(match[0]);
            }

            if (hp.includes('CPA')) {
                num = num * 100; // 1.5 CPA -> 150 LPA
            }

            bulkOps.push({
                updateOne: {
                    filter: { _id: c._id },
                    update: { $set: { 'placements.highestPackageNumeric': num } }
                }
            });
        }

        if (bulkOps.length > 0) {
            const res = await db.collection('colleges').bulkWrite(bulkOps);
            console.log("Updated", res.modifiedCount, "colleges with highestPackageNumeric");
        }

        process.exit(0);
    });
