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

// Helper to clean HTML and Entities
function decodeHTMLEntities(text) {
    if (!text) return "";
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<\/?[^>]+(>|$)/g, "") // Remove remaining HTML tags
        .replace(/&nbsp;&nbsp;[^-]+$/, "") // Remove Google News source suffix
        .trim();
}

// Helper to parse RSS with regex (avoiding XML dep)
function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
        const content = match[1];
        const titleRaw = content.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
        const link = content.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
        const pubDate = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || new Date().toISOString();
        const descriptionRaw = content.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "";

        if (titleRaw && link) {
            const title = decodeHTMLEntities(titleRaw);
            let summary = decodeHTMLEntities(descriptionRaw);
            
            // If summary is just a link or too short, use a fallback
            if (summary.startsWith("http") || summary.length < 20) {
                summary = "Live updates on examination schedules and academic trends.";
            }

            items.push({
                id: `rss-${Buffer.from(link).toString('base64').substring(0, 16)}`,
                title: title.replace(/\s\-\s[^-]+$/, "").trim(),
                summary: summary.substring(0, 250),
                category: "Live Update",
                date: new Date(pubDate).toISOString(),
                source: "Google News Feed",
                url: link,
                urgent: false
            });
        }
    }
    return items;
}

// Helper to categorize and verify source
function classifySource(item) {
    const url = (item.url || "").toLowerCase();
    const title = (item.title || "").toLowerCase();
    
    // Taxonomy: Official Authority Check
    const isOfficial = url.includes(".gov.in") || 
                       url.includes(".nic.in") || 
                       url.includes("nta.ac.in") || 
                       url.includes("iimcat.ac.in");

    let category = "Trends";
    let type = "GENERAL";
    let urgency = 1;

    // Granular Categorization logic
    if (title.includes("result") || title.includes("scorecard") || title.includes("marks")) {
        category = "Results";
        urgency = 4;
    } else if (title.includes("admit card") || title.includes("hall ticket")) {
        category = "Admit Cards";
        urgency = 5; // Extremely urgent
    } else if (title.includes("merit list") || title.includes("selection list")) {
        category = "Merit Lists";
        urgency = 4;
    } else if (title.includes("admission") || title.includes("counseling") || title.includes("registration")) {
        category = "Admissions";
        urgency = 3;
    } else if (title.includes("scholarship") || title.includes("fellowship") || title.includes("grant")) {
        category = "Scholarships";
        urgency = 3;
    } else if (title.includes("exam") || title.includes("date") || title.includes("schedule")) {
        category = "Exams";
        urgency = 2;
    } else if (title.includes("notification") || title.includes("circular") || title.includes("gazette")) {
        category = "Notifications";
        urgency = 2;
    }

    // Official override
    if (isOfficial) {
        category = "Official"; 
        type = "TRUSTED";
        urgency += 1; // Boost urgency for official news
    } else if (category === "Trends" && (title.includes("prep") || title.includes("mock") || title.includes("strategy"))) {
        category = "Preparation";
        type = "EXPERT";
    }

    return { 
        category, 
        sourceType: type, 
        urgency: Math.min(urgency, 5),
        isOfficial 
    };
}

// Function to handle the actual refresh (updates disk)
async function refreshNews() {
    console.log("🔄 Triggering Quantum Multi-Stream Intelligence Refresh...");
    try {
        const streams = [
            { id: "official", query: 'site:nta.ac.in OR site:exams.nta.ac.in OR site:jeemain.nta.nic.in OR site:cmat.nta.nic.in admit card result declared date updates when:7d' },
            { id: "alerts", query: 'JEE Main result GUJCET admit card ACPC merit list MBA entrance when:7d' },
            { id: "scholarships", query: 'Indian government scholarship for students 2026 when:1m' },
            { id: "prep", query: 'MBA entrance exam preparation tips when:1m' }
        ];

        const results = await Promise.all(streams.map(stream => 
            axios.get(`https://news.google.com/rss/search?q=${encodeURIComponent(stream.query)}`, { timeout: 10000 })
        ));

        const allRssItems = results.flatMap(res => parseRSS(res.data));
        if (allRssItems.length === 0) return false;

        const currentData = loadNewsFromDisk();
        const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
        const cutoffDate = Date.now() - NINETY_DAYS_MS;
        
        const freshDiskData = currentData.filter(item => new Date(item.date).getTime() > cutoffDate);

        // Advanced Deduplication with normalized titles
        const normalizeTitle = (t) => t.toLowerCase().replace(/&amp;/g, "").replace(/[^a-z0-9]/g, "").substring(0, 90);
        
        const newItems = [];
        for (const item of allRssItems) {
            const { category, sourceType, urgency, isOfficial } = classifySource(item);
            item.category = category;
            item.sourceType = sourceType;
            item.urgency = urgency;
            item.isOfficial = isOfficial;
            newItems.push(item);
        }

        const allItems = [...newItems, ...freshDiskData];
        const uniqueMap = new Map();
        
        allItems.forEach(item => {
            const norm = normalizeTitle(item.title);
            if (!uniqueMap.has(norm)) {
                uniqueMap.set(norm, item);
            }
        });

        const updatedNews = Array.from(uniqueMap.values())
            .sort((a, b) => {
                if (a.category === "Official" && b.category !== "Official") return -1;
                if (b.category === "Official" && a.category !== "Official") return 1;
                return new Date(b.date) - new Date(a.date);
            })
            .slice(0, 150);

        fs.writeFileSync(newsFilePath, JSON.stringify(updatedNews, null, 2));
        console.log(`✅ Intelligence Feed Updated. Total Unique: ${updatedNews.length}`);
        return true;
    } catch (err) {
        console.error("❌ Intelligence refresh failed:", err.message);
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
