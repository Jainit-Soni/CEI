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
        return true; // All time
    });
};

// @route   GET /api/hype/stats
// @desc    Get aggregated stats and recent ticker
// @access  Public
router.get("/stats", (req, res) => {
    try {
        const timeframe = req.query.timeframe || "daily";
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
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10);

        res.json({ leaderboard, recentVotes });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   POST /api/hype/vote
// @desc    Cast a vote (Protected)
// @access  Protected
router.post("/vote", (req, res) => {
    try {
        // In real app, get userId from req.user
        const { collegeId, collegeName, userId, userName } = req.body;

        if (!collegeId || !userId) {
            return res.status(400).json({ error: "Invalid Data" });
        }

        const newVote = {
            collegeId,
            collegeName,
            userId,
            userName: userName || "Anonymous",
            timestamp: new Date().toISOString()
        };

        // Add to in-memory array
        votesData.push(newVote);

        // Persist to file
        fs.writeFile(votesFilePath, JSON.stringify(votesData, null, 2), (err) => {
            if (err) {
                console.error("Failed to write votes file:", err);
                return res.status(500).json({ error: "Failed to save vote" });
            }
            res.json({ success: true, vote: newVote });
        });

    } catch (err) {
        console.error("Vote error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

module.exports = router;
