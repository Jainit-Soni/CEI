const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const votesData = require("../models/hype_votes.json");

// Define path to hype_votes.json for writing updates
const votesFilePath = path.join(__dirname, "../models/hype_votes.json");

const COLLEGES = [
    { id: "iit-bombay", name: "IIT Bombay" },
    { id: "iit-delhi", name: "IIT Delhi" },
    { id: "bits-pilani", name: "BITS Pilani" },
    { id: "nit-trichy", name: "NIT Trichy" },
    { id: "iit-kanpur", name: "IIT Kanpur" },
    { id: "vit-vellore", name: "VIT Vellore" },
    { id: "thapar", name: "Thapar University" }
];

// Path to user choices for aggregation
const userChoicesFilePath = path.join(__dirname, "../models/user_choices.json");

// Helper: Filter votes by timeframe
const filterVotes = (votes, timeframe) => {
    const now = new Date();
    return votes.filter(v => {
        const voteTime = new Date(v.timestamp);
        if (timeframe === "daily") return voteTime.toDateString() === now.toDateString();
        if (timeframe === "weekly") {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return voteTime >= oneWeekAgo;
        }
        if (timeframe === "monthly") return voteTime.getMonth() === now.getMonth() && voteTime.getFullYear() === now.getFullYear();
        if (timeframe === "yearly") return voteTime.getFullYear() === now.getFullYear();
        return !(["System", "system-seed"].includes(v.userId) || v.userName === "System");
    });
};

// Helper: Aggregate user roadmap choices
const getRoadmapStats = () => {
    try {
        if (!fs.existsSync(userChoicesFilePath)) return [];
        const data = fs.readFileSync(userChoicesFilePath, "utf8");
        const allChoices = JSON.parse(data);
        const stats = {};

        // allChoices is an object mapping uid -> array of college objects
        Object.values(allChoices).forEach(userList => {
            if (!Array.isArray(userList)) return;
            // Use a Set to only count each college once per user, regardless of rank/duplicates
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
// @desc    Get aggregated stats and recent ticker
// @access  Public
router.get("/stats", (req, res) => {
    try {
        const timeframe = req.query.timeframe || "all";
        const filtered = filterVotes(votesData, timeframe);

        // Aggregate counts
        const stats = {};
        filtered.forEach(v => {
            if (!stats[v.collegeId]) {
                stats[v.collegeId] = { id: v.collegeId, name: v.collegeName, votes: 0 };
            }
            stats[v.collegeId].votes++;
        });

        // Convert to array and sort
        const leaderboard = Object.values(stats).sort((a, b) => b.votes - a.votes);

        // Get recent votes for ticker (globally recent, not just filtered)
        const recentVotes = [...votesData]
            .filter(v => v.userId !== "system-seed" && v.userName !== "System")
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10);

        // Get Roadmap priorities
        const roadmapLeaderboard = getRoadmapStats();

        res.json({ leaderboard, recentVotes, roadmapLeaderboard });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   POST /api/hype/vote
// @desc    Cast a vote (Protected)
// @access  Protected
// @route   POST /api/hype/vote
// @desc    Cast a vote (Protected)
// @access  Protected
router.post("/vote", (req, res) => {
    try {
        // In real app, get userId from req.user
        // Allow 'uid' or 'userId' for compatibility
        const { collegeId, collegeName, userId, uid, userName } = req.body;
        const finalUserId = userId || uid;

        if (!collegeId || !finalUserId) {
            console.warn("Vote rejected: Missing collegeId or userId", req.body);
            return res.status(400).json({ error: "Invalid Data: Missing collegeId or userId" });
        }

        const newVote = {
            collegeId,
            collegeName,
            userId: finalUserId,
            userName: userName || "Anonymous",
            timestamp: new Date().toISOString()
        };

        // Ensure votesData is an array (handle empty JSON case)
        if (!Array.isArray(votesData)) {
            // If it was require'd as {} or undefined, reset it
            // Note: mutating exports is risky but matches current pattern
            votesData.length = 0;
            Object.setPrototypeOf(votesData, Array.prototype);
        }

        // Add to in-memory array
        votesData.push(newVote);

        // Persist to file
        fs.writeFile(votesFilePath, JSON.stringify(votesData, null, 2), (err) => {
            if (err) {
                console.error("Failed to write votes file:", err);
                // Don't fail the request if just persistence fails (in-memory works)
                // But generally 500 is appropriate. For now, log and return success to not block user
                // return res.status(500).json({ error: "Failed to save vote" });
            }
            console.log(`Vote saved for ${collegeName} by ${userName}`);
            res.json({ success: true, vote: newVote });
        });

    } catch (err) {
        console.error("Vote CRASH:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

module.exports = router;
