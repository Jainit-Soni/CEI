const mongoose = require('mongoose');
const Redis = require('ioredis');

const mongoUri = "mongodb://JAINIT:Uu4mAS9IQ7Q9NEX4@ac-jmm94uu-shard-00-00.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-01.shlqnzg.mongodb.net:27017,ac-jmm94uu-shard-00-02.shlqnzg.mongodb.net:27017/cei?ssl=true&authSource=admin&retryWrites=true";
const redisUrl = "rediss://default:AVRdAAIncDJiMDg1MjJlZDE3ZTA0MWZiOTA4YWE3MDYxZmU3ZTVjNnAyMjE1OTc@allowed-louse-21597.upstash.io:6379";

async function run() {
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    
    // IIM Ahmedabad is historically consistently #1 in management
    await db.collection('colleges').updateOne(
        { id: 'iim-ahm' },
        { 
            $set: { 
                ceiScore: 99.85, 
                competitivenessBand: 'Elite',
                verificationStatus: 'Manual Administrator Override'
            } 
        }
    );
    console.log("Successfully patched IIM Ahmedabad (iim-ahm) with 99.85 Elite score in MongoDB.");

    const client = new Redis(redisUrl);
    const keys = await client.keys('mongo:college:*');
    if(keys.length > 0) {
        await client.del(keys);
        console.log(`Cleared ${keys.length} stale college caches from Redis.`);
    }
    
    process.exit(0);
}

run().catch(console.error);
