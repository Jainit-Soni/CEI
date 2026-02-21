const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { getRedisClient } = require("../config/redis");

const votesFilePath = path.join(__dirname, "../models/hype_votes.json");

// Helper: Read votes from Redis (with disk fallback)
const readVotes = async () => {
    try {
        const redisClient = await getRedisClient();
        if (redisClient) {
            const data = await redisClient.get("ce_hype_votes");
            if (data) return JSON.parse(data);
        }
    } catch (err) {
        console.error("Redis read error:", err);
    }

    // Disk fallback (for initial local load or if Redis fails)
    try {
        if (!fs.existsSync(votesFilePath)) return [];
        const data = fs.readFileSync(votesFilePath, "utf8");
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading votes fallback:", err);
        return [];
    }
};

// Helper: Save votes to Redis (with disk fallback)
const saveVotes = async (votes) => {
    let saved = false;
    try {
        const redisClient = await getRedisClient();
        if (redisClient) {
            await redisClient.set("ce_hype_votes", JSON.stringify(votes));
            saved = true;
        }
    } catch (err) {
        console.error("Redis save error:", err);
    }

    try {
        fs.writeFileSync(votesFilePath, JSON.stringify(votes, null, 2), "utf8");
        saved = true;
    } catch (err) {
        // On Vercel this will always fail. Normal behavior.
        if (!saved) console.error("Failed to write votes fallback:", err);
    }

    return saved;
};

const COLLEGES = [
    { id: "iit-bombay", name: "Indian Institute of Technology Bombay" },
    { id: "iit-delhi", name: "Indian Institute of Technology Delhi" },
    { id: "bits-pilani", name: "Birla Institute of Technology and Science, Pilani" },
    { id: "nit-trichy", name: "National Institute of Technology Thiruchirappalli" },
    { id: "iit-kanpur", name: "Indian Institute of Technology Kanpur" },
    { id: "vit-vellore", name: "Vellore Institute of Technology" },
    { id: "thapar", name: "Thapar Institute of Engineering and Technology" }
];

const userChoicesFilePath = path.join(__dirname, "../models/user_choices.json");

// Helper: Filter votes by timeframe
const filterVotes = (votes, timeframe) => {
    const now = new Date();
    return votes.filter(v => {
        const isSystem = ["System", "system-seed"].includes(v.userId) || v.userName === "System";
        if (timeframe === "all") return true;

        const voteTime = new Date(v.timestamp);
        if (timeframe === "daily") return voteTime.toDateString() === now.toDateString() && !isSystem;
        if (timeframe === "weekly") {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return voteTime >= oneWeekAgo && !isSystem;
        }
        if (timeframe === "monthly") return voteTime.getMonth() === now.getMonth() && voteTime.getFullYear() === now.getFullYear() && !isSystem;
        if (timeframe === "yearly") return voteTime.getFullYear() === now.getFullYear() && !isSystem;

        return !isSystem;
    });
};

// Helper: Aggregate user roadmap choices (Redis + disk fallback)
const getRoadmapStats = async () => {
    const stats = {};

    // 1. Try Redis first (Primary source of truth on Vercel)
    try {
        const redisClient = await getRedisClient();
        if (redisClient) {
            const keys = await redisClient.keys("user:choices:*");
            for (const key of keys) {
                const data = await redisClient.get(key);
                if (data) {
                    const userList = JSON.parse(data);
                    if (!Array.isArray(userList)) continue;

                    const uniqueCollegesForUser = new Set();
                    userList.forEach(college => {
                        if (college && college.id) {
                            uniqueCollegesForUser.add(JSON.stringify({ id: college.id, name: college.name || college.shortName }));
                        }
                    });

                    uniqueCollegesForUser.forEach(collegeStr => {
                        const college = JSON.parse(collegeStr);
                        if (!stats[college.id]) {
                            stats[college.id] = { id: college.id, name: college.name, priorityCount: 0 };
                        }
                        stats[college.id].priorityCount++;
                    });
                }
            }
            if (keys.length > 0) {
                return Object.values(stats).sort((a, b) => b.priorityCount - a.priorityCount);
            }
        }
    } catch (err) {
        console.error("Redis roadmap aggregate error:", err);
    }

    // 2. Disk fallback
    try {
        if (!fs.existsSync(userChoicesFilePath)) return [];
        const data = fs.readFileSync(userChoicesFilePath, "utf8");
        const allChoices = JSON.parse(data);

        Object.values(allChoices).forEach(userList => {
            if (!Array.isArray(userList)) return;
            const uniqueCollegesForUser = new Set();
            userList.forEach(college => {
                if (college && college.id) {
                    uniqueCollegesForUser.add(JSON.stringify({ id: college.id, name: college.name || college.shortName }));
                }
            });

            uniqueCollegesForUser.forEach(collegeStr => {
                const college = JSON.parse(collegeStr);
                if (!stats[college.id]) {
                    stats[college.id] = { id: college.id, name: college.name, priorityCount: 0 };
                }
                stats[college.id].priorityCount++;
            });
        });

        return Object.values(stats).sort((a, b) => b.priorityCount - a.priorityCount);
    } catch (err) {
        console.error("Error aggregating roadmap stats:", err);
        return [];
    }
};

// @route   GET /api/hype/stats
router.get("/stats", async (req, res) => {
    try {
        const timeframe = req.query.timeframe || "all";
        const votes = await readVotes();
        const filtered = filterVotes(votes, timeframe);

        const stats = {};
        filtered.forEach(v => {
            if (!stats[v.collegeId]) {
                stats[v.collegeId] = { id: v.collegeId, name: v.collegeName, votes: 0 };
            }
            stats[v.collegeId].votes++;
        });

        const leaderboard = Object.values(stats).sort((a, b) => b.votes - a.votes);

        const recentVotes = [...votes]
            .filter(v => v.userId !== "system-seed" && v.userName !== "System")
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10);

        const roadmapLeaderboard = await getRoadmapStats();

        res.json({ leaderboard, recentVotes, roadmapLeaderboard });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   POST /api/hype/vote
router.post("/vote", async (req, res) => {
    try {
        const { collegeId, collegeName, userId, uid, userName } = req.body;
        const finalUserId = userId || uid;

        if (!collegeId || !finalUserId) {
            return res.status(400).json({ error: "Invalid Data: Missing collegeId or userId" });
        }

        const newVote = {
            collegeId,
            collegeName,
            userId: finalUserId,
            userName: userName || "Anonymous",
            timestamp: new Date().toISOString()
        };

        const votes = await readVotes();
        votes.push(newVote);

        const success = await saveVotes(votes);

        if (success) {
            console.log(`Vote saved for ${collegeName} by ${userName}`);
            res.json({ success: true, vote: newVote });
        } else {
            res.status(500).json({ error: "Failed to persist vote" });
        }

    } catch (err) {
        console.error("Vote Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

module.exports = router;
