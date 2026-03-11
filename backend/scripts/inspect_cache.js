const { getRedisClient } = require('../config/redis');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
const College = require('../models/CollegeSchema');

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const redis = await getRedisClient();

        console.log('--- Database Search (All IIM Bangalore candidates) ---');
        const dbColleges = await College.find({
            $or: [
                { name: /Indian Institute of Management/i },
                { shortName: /IIM/i }
            ],
            $or: [
                { location: /Bangalore|Bengaluru/i },
                { name: /Bangalore|Bengaluru/i }
            ]
        }).select('id name shortName location ceiScore rankingTier').lean();
        console.log(JSON.stringify(dbColleges, null, 2));

        if (redis) {
            console.log('\n--- Redis Cache Inspection ---');
            const keys = await redis.keys('ranking:*');
            console.log('Found ranking keys:', keys.length);

            // Look for IIM Bangalore in the most common ranking keys
            const interestingKeys = [
                'ranking:global:ceiScore',
                'ranking:state:Karnataka:ceiScore',
                'ranking:tier:Tier 1:ceiScore'
            ];

            for (const key of interestingKeys) {
                const data = await redis.get(key);
                if (data) {
                    const parsed = JSON.parse(data);
                    const list = parsed.data || parsed;
                    const match = list.find(c => c.name.includes('Management') && c.name.includes('Bangalore'));
                    if (match) {
                        console.log(`Match found in ${key}:`, JSON.stringify(match, null, 2));
                    }
                }
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
