const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { getRedisClient } = require("../config/redis");

const votesFilePath = path.join(__dirname, "../models/hype_votes.json");

// Keys
const REDIS_KEY_LEADERBOARD = "ce_hype_zset_leaderboard";
const REDIS_KEY_RECENT = "ce_hype_list_recent";

// Helper: Seed Redis from Disk if empty
const seedRedisIfEmpty = async () => {
    try {
        const redisClient = await getRedisClient();
        if (!redisClient) return;

        const exists = await redisClient.exists(REDIS_KEY_LEADERBOARD);
        if (exists) return;

        console.log("Seeding Redis Hype data from disk...");
        let votes = [];
        if (fs.existsSync(votesFilePath)) {
            const data = fs.readFileSync(votesFilePath, "utf8");
            votes = JSON.parse(data);
        }

        // Aggregate for Sorted Set
        const pipeline = redisClient.pipeline();
        const counts = {};
        votes.forEach(v => {
            counts[v.collegeId] = (counts[v.collegeId] || 0) + 1;
        });

        for (const [id, score] of Object.entries(counts)) {
            pipeline.zadd(REDIS_KEY_LEADERBOARD, score, id);
        }

        // Store some metadata for names (since Sorted Sets only store IDs)
        votes.forEach(v => {
            pipeline.hset("ce_hype_names", v.collegeId, v.collegeName);
        });

        // Recent votes
        const recent = votes.slice(-50).reverse();
        recent.forEach(v => {
            pipeline.rpush(REDIS_KEY_RECENT, JSON.stringify(v));
        });

        await pipeline.exec();
        console.log("Redis Hype seeding complete.");
    } catch (err) {
        console.error("Redis Seeding Error:", err);
    }
};

seedRedisIfEmpty();

// Helper: Aggregate user roadmap choices (Redis + disk fallback)
const getRoadmapStats = async () => {
    const stats = {};
    try {
        const redisClient = await getRedisClient();
        if (redisClient) {
            const keys = await redisClient.keys("user:choices:*");
            for (const key of keys) {
                const data = await redisClient.get(key);
                if (data) {
                    const userList = JSON.parse(data);
                    if (!Array.isArray(userList)) continue;
                    const seenInList = new Set();
                    userList.forEach(c => {
                        if (c?.id && !seenInList.has(c.id)) {
                            seenInList.add(c.id);
                            if (!stats[c.id]) stats[c.id] = { id: c.id, name: c.name || c.shortName, priorityCount: 0 };
                            stats[c.id].priorityCount++;
                        }
                    });
                }
            }
            if (keys.length > 0) return Object.values(stats).sort((a, b) => b.priorityCount - a.priorityCount);
        }
    } catch (err) { }
    return [];
};

// @route   GET /api/hype/stats
router.get("/stats", async (req, res) => {
    try {
        const redisClient = await getRedisClient();
        let leaderboard = [];
        let recentVotes = [];

        if (redisClient) {
            // 1. Get Top 100 from Sorted Set (High Performance)
            const zData = await redisClient.zrevrange(REDIS_KEY_LEADERBOARD, 0, 99, "WITHSCORES");
            const namesHash = await redisClient.hgetall("ce_hype_names");

            for (let i = 0; i < zData.length; i += 2) {
                const id = zData[i];
                const score = parseInt(zData[i + 1]);
                leaderboard.push({
                    id,
                    name: namesHash[id] || id,
                    votes: score
                });
            }

            // 2. Get Recent Votes from List
            const rawRecent = await redisClient.lrange(REDIS_KEY_RECENT, 0, 14);
            recentVotes = rawRecent.map(v => JSON.parse(v));
        } else {
            // Disk Fallback
            if (fs.existsSync(votesFilePath)) {
                const votes = JSON.parse(fs.readFileSync(votesFilePath, "utf8"));
                const counts = {};
                const names = {};
                votes.forEach(v => {
                    counts[v.collegeId] = (counts[v.collegeId] || 0) + 1;
                    names[v.collegeId] = v.collegeName;
                });
                leaderboard = Object.entries(counts).map(([id, votes]) => ({
                    id,
                    name: names[id],
                    votes
                })).sort((a, b) => b.votes - a.votes).slice(0, 100);

                recentVotes = votes.slice(-15).reverse();
            }
        }

        const roadmapLeaderboard = await getRoadmapStats();
        res.json({ leaderboard, recentVotes, roadmapLeaderboard });
    } catch (err) {
        console.error("Stats Error:", err.message);
        res.status(500).send("Server Error");
    }
});

// @route   POST /api/hype/vote
router.post("/vote", async (req, res) => {
    try {
        const { collegeId, collegeName, uid, userName } = req.body;
        if (!collegeId || !uid) return res.status(400).json({ error: "Missing data" });

        const redisClient = await getRedisClient();

        // 1. Validation Check (Redis + Disk Fallback)
        if (redisClient) {
            const hasVoted = await redisClient.sismember(`ce_hype_user_votes:${uid}`, collegeId);
            if (hasVoted) return res.status(400).json({ error: "Already voted for this college" });
        } else {
            if (fs.existsSync(votesFilePath)) {
                const existingVotes = JSON.parse(fs.readFileSync(votesFilePath, "utf8"));
                if (existingVotes.some(v => v.userId === uid && v.collegeId === collegeId)) {
                    return res.status(400).json({ error: "Already voted for this college" });
                }
            }
        }

        const newVote = {
            collegeId,
            collegeName,
            userId: uid,
            userName: userName || "Student",
            timestamp: new Date().toISOString()
        };

        // 2. Commit Vote to Redis
        if (redisClient) {
            const pipeline = redisClient.pipeline();
            pipeline.zincrby(REDIS_KEY_LEADERBOARD, 1, collegeId);
            pipeline.hset("ce_hype_names", collegeId, collegeName);
            pipeline.sadd(`ce_hype_user_votes:${uid}`, collegeId); // Track user vote
            pipeline.lpush(REDIS_KEY_RECENT, JSON.stringify(newVote));
            pipeline.ltrim(REDIS_KEY_RECENT, 0, 49);
            await pipeline.exec();
        }

        // 3. Always persist to disk as master backup
        let votes = [];
        if (fs.existsSync(votesFilePath)) {
            votes = JSON.parse(fs.readFileSync(votesFilePath, "utf8"));
        }
        votes.push(newVote);
        fs.writeFileSync(votesFilePath, JSON.stringify(votes, null, 2));

        res.json({ success: true });
    } catch (err) {
        console.error("Vote Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

module.exports = router;
