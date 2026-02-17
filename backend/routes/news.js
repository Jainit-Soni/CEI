const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const newsData = require("../models/news.json");

// Define path to news.json for writing updates
const newsFilePath = path.join(__dirname, "../models/news.json");

// @route   GET /api/news
// @desc    Get all news items, sorted by date (newest first)
// @access  Public
router.get("/", (req, res) => {
    try {
        const sortedNews = [...newsData].sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(sortedNews);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   POST /api/news
// @desc    Add a new news item (Admin only)
// @access  Protected (In a real app, strict middleware here. For now, client-side secret check)
router.post("/", (req, res) => {
    try {
        const { title, summary, category, url, urgent } = req.body;

        if (!title || !summary) {
            return res.status(400).json({ error: "Title and Summary are required" });
        }

        const newItem = {
            id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now(),
            title,
            summary,
            category: category || "General",
            date: new Date().toISOString(),
            source: "CEI Admin", // Or User input
            url: url || "",
            urgent: urgent || false
        };

        // Add to in-memory array
        newsData.unshift(newItem);

        // Persist to file (Simulating DB write)
        fs.writeFile(newsFilePath, JSON.stringify(newsData, null, 2), (err) => {
            if (err) {
                console.error("Failed to write news file:", err);
                return res.status(500).json({ error: "Failed to save news" });
            }
            res.json(newItem);
        });

    } catch (err) {
        console.error("News post error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

module.exports = router;
