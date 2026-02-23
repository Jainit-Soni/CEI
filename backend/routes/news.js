const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Define path to news.json for writing updates
const newsFilePath = path.join(__dirname, "../models/news.json");

// Helper to load news from disk directly (bypasses memory cache)
function loadNewsFromDisk() {
    try {
        if (!fs.existsSync(newsFilePath)) return [];
        // No caching! Direct read to stay synced with disk-force-updates
        const data = fs.readFileSync(newsFilePath, "utf8");
        return JSON.parse(data);
    } catch (e) {
        console.error("❌ Failed to load news from disk:", e.message);
        return [];
    }
}

let lastRefresh = 0;
const REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

// Helper to parse RSS with regex (avoiding XML dep)
function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
        const content = match[1];
        const title = content.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
        const link = content.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
        const pubDate = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || new Date().toISOString();

        if (title && link) {
            items.push({
                id: `rss-${Buffer.from(link).toString('base64').substring(0, 16)}`,
                title: title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim(),
                summary: "Live update from educational news wire.",
                category: "Live Update",
                date: new Date(pubDate).toISOString(),
                source: "Google News",
                url: link,
                urgent: false
            });
        }
    }
    return items;
}

// Function to handle the actual refresh (updates disk)
async function refreshNews() {
    console.log("🔄 Triggering live news refresh from Google RSS...");
    try {
        const response = await axios.get('https://news.google.com/rss/search?q=MBA+Entrance+Exams+India+admission+CAT+CMAT+NEET+JEE+admissions', { timeout: 8000 });
        const rssItems = parseRSS(response.data);

        if (rssItems.length === 0) return false;

        // Load current disk state to check for dupes
        const currentData = loadNewsFromDisk();
        const normalizeTitle = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 60);
        const existingTitles = new Set(currentData.map(n => normalizeTitle(n.title)));

        const newItems = rssItems.filter(item => !existingTitles.has(normalizeTitle(item.title)));

        if (newItems.length > 0) {
            const updatedNews = [...newItems, ...currentData].slice(0, 100);
            fs.writeFileSync(newsFilePath, JSON.stringify(updatedNews, null, 2));
            console.log(`✅ Success: ${newItems.length} new items added to disk.`);
            return true;
        }
        return false;
    } catch (err) {
        console.error("❌ RSS refresh failed:", err.message);
        return false;
    }
}

// @route   GET /api/news
router.get("/", async (req, res) => {
    try {
        const now = Date.now();

        // ALWAYS READ FROM DISK (guarantees freshness after force-updates)
        let diskNews = loadNewsFromDisk();

        // Auto-refresh logic
        if (diskNews.length < 10) {
            console.log("⚠️ Data sparse, forcing synchronous refresh...");
            await refreshNews();
            diskNews = loadNewsFromDisk(); // Re-read after refresh
            lastRefresh = now;
        }
        else if (now - lastRefresh > REFRESH_INTERVAL) {
            console.log("🕒 Data stale, triggering background refresh...");
            lastRefresh = now;
            refreshNews();
        }

        const sortedNews = [...diskNews].sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(sortedNews);
    } catch (err) {
        console.error("News GET error:", err.message);
        res.status(500).send("Server Error");
    }
});

// @route   POST /api/news
router.post("/", (req, res) => {
    try {
        const { title, summary, category, url, urgent } = req.body;
        if (!title || !summary) return res.status(400).json({ error: "Title/Summary required" });

        const newItem = {
            id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now(),
            title,
            summary,
            category: category || "General",
            date: new Date().toISOString(),
            source: "CEI Admin",
            url: url || "",
            urgent: urgent || false
        };

        const diskNews = loadNewsFromDisk();
        diskNews.unshift(newItem);
        fs.writeFileSync(newsFilePath, JSON.stringify(diskNews, null, 2));
        res.json(newItem);
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

module.exports = router;
