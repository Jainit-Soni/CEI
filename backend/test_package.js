const mongoose = require('mongoose');

const uri = "mongodb://JAINIT:Uu4mAS9IQ7Q9NEX4@ac-jmm94uu-shard-00-00.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-01.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-02.shlqnzg.mongodb.net:27017/cei?ssl=true&authSource=admin&retryWrites=true";

mongoose.connect(uri)
    .then(async () => {
        const db = mongoose.connection.db;
        const sample = await db.collection('colleges').find({ 'placements.highestPackage': { $exists: true, $ne: null } }).limit(10).toArray();
        console.log(sample.map(x => x.placements.highestPackage));
        process.exit(0);
    });
