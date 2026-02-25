require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');

const manualUri = "mongodb://JAINIT:sSoTP4KuLxnfCzTi@ac-jmm94uu-shard-00-00.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-01.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-02.shlqnzg.mongodb.net:27017/cei?ssl=true&authSource=admin&retryWrites=true";

console.log('Testing manual connection string...');

mongoose.connect(manualUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000
})
    .then(() => {
        console.log('✅ Success! Connected to MongoDB Atlas.');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Connection Failed:', err.message);
        process.exit(1);
    });
