const fs = require('fs');
const path = require('path');
const axios = require('axios');

const newsFilePath = path.join(__dirname, "../models/news.json");

function loadNewsFromDisk() {
    try {
        if (!fs.existsSync(newsFilePath)) return [];
        const data = fs.readFileSync(newsFilePath, "utf8");
        return JSON.parse(data);
    } catch (e) {
        console.error("❌ Failed to load news from disk:", e.message);
        return [];
    }
}

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
        .replace(/<\/?[^>]+(>|$)/g, "")
        .replace(/&nbsp;&nbsp;[^-]+$/, "")
        .trim();
}

const FORBIDDEN_KEYWORDS = [
    "strategy", "tips", "prep", "best colleges", "how to", "ranking", "career options", 
    "preparation", "guide", "top 10", "salary", "jobs after", "syllabus analysis"
];

const SIGNAL_KEYWORDS = {
    "Results": ["result", "scorecard", "marks", "declared", "out now"],
    "Admit Cards": ["admit card", "hall ticket", "download", "released"],
    "Merit Lists": ["merit list", "selection list", "provisional list", "cutoff"],
    "Admissions": ["admission", "counseling", "registration", "open", "apply now", "last date"],
    "Scholarships": ["scholarship", "fellowship", "grant", "stipend"],
    "Exams": ["exam date", "schedule", "timetable", "postponed", "rescheduled"],
    "Notifications": ["notification", "official notice", "circular", "press release"]
};

const AUTHORITIES = [
    { name: "NTA", patterns: ["nta.ac.in", "exams.nta.ac.in"] },
    { name: "CBSE", patterns: ["cbse.gov.in", "cbse.nic.in"] },
    { name: "MCC", patterns: ["mcc.nic.in"] },
    { name: "ACPC", patterns: ["jacpcldce.ac.in"] },
    { name: "UGC", patterns: ["ugc.ac.in"] },
    { name: "AICTE", patterns: ["aicte-india.org"] },
    { name: "IIM", patterns: ["iimcat.ac.in", "iimb.ac.in", "iiml.ac.in"] },
    { name: "IIT", patterns: ["iitb.ac.in", "iitd.ac.in", "iitk.ac.in", "iitkgp.ac.in"] }
];

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
            const summary = decodeHTMLEntities(descriptionRaw);
            
            // 1. Strict Filtering
            const lowerTitle = title.toLowerCase();
            const isNoisy = FORBIDDEN_KEYWORDS.some(kw => lowerTitle.includes(kw));
            if (isNoisy) continue;

            items.push({
                id: `signal-${Buffer.from(link).toString('base64').substring(0, 16)}`,
                title: title.replace(/\s\-\s[^-]+$/, "").trim(),
                summary: summary.length > 20 ? summary.substring(0, 300) : "Official academic update signal detected.",
                date: new Date(pubDate).toISOString(),
                url: link
            });
        }
    }
    return items;
}

function extractStructuredData(item) {
    const title = item.title.toLowerCase();
    const url = item.url.toLowerCase();
    
    let category = "Notifications";
    let urgency = 1;
    let actionLabel = "View Notice";
    let authority = "Academic Source";
    let isOfficial = false;

    // Detect Authority
    for (const auth of AUTHORITIES) {
        if (auth.patterns.some(p => url.includes(p) || title.includes(auth.name.toLowerCase()))) {
            authority = auth.name;
            isOfficial = true;
            break;
        }
    }

    if (!isOfficial) {
        if (url.includes(".gov.in") || url.includes(".nic.in")) {
            authority = "Govt. Portal";
            isOfficial = true;
        }
    }

    // Detect Category & Urgency
    for (const [cat, keywords] of Object.entries(SIGNAL_KEYWORDS)) {
        if (keywords.some(kw => title.includes(kw))) {
            category = cat;
            if (cat === "Results") { urgency = 5; actionLabel = "Check Result"; }
            if (cat === "Admit Cards") { urgency = 5; actionLabel = "Download card"; }
            if (cat === "Admissions") { urgency = 4; actionLabel = "Apply now"; }
            if (cat === "Exams") { urgency = 4; actionLabel = "View schedule"; }
            break;
        }
    }

    if (isOfficial) urgency = Math.min(urgency + 1, 5);

    return { 
        category, 
        urgency, 
        isOfficial, 
        authority, 
        actionLabel,
        sourceType: isOfficial ? "TRUSTED" : "GENERAL_INTEL"
    };
}

async function forceRefresh() {
    console.log("🚀 Starting Academic Update Engine: Intelligence Extraction...");
    try {
        const streams = [
            { id: "govt", query: 'site:gov.in OR site:nic.in result declared OR admit card released OR notification when:7d' },
            { id: "nta", query: 'site:nta.ac.in OR site:exams.nta.ac.in result OR admit card OR schedule when:7d' },
            { id: "exams", query: 'JEE Main Result declared OR CMAT admit card released OR CAT result when:7d' },
            { id: "scholarships", query: 'NSP scholarship registration open OR merit list released when:1m' }
        ];

        const results = await Promise.all(streams.map(stream => 
            axios.get(`https://news.google.com/rss/search?q=${encodeURIComponent(stream.query)}`, { timeout: 15000 })
        ));

        const allRawItems = results.flatMap(res => parseRSS(res.data));
        console.log(`📡 Extracted ${allRawItems.length} raw potential signals.`);

        const currentData = loadNewsFromDisk();
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // Stay fresher
        const cutoffDate = Date.now() - THIRTY_DAYS_MS;
        const freshDiskData = currentData.filter(item => new Date(item.date).getTime() > cutoffDate);

        const processedItems = allRawItems.map(item => ({
            ...item,
            ...extractStructuredData(item)
        }));

        // Sophisticated Deduplication (Title Normalization + Category)
        const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 60);
        const uniqueMap = new Map();

        [...processedItems, ...freshDiskData].forEach(item => {
            const key = `${normalize(item.title)}-${item.category}`;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, item);
            } else {
                // Keep the one with higher urgency or official status
                const existing = uniqueMap.get(key);
                if ((item.isOfficial && !existing.isOfficial) || (item.urgency > existing.urgency)) {
                    uniqueMap.set(key, item);
                }
            }
        });

        const finalNews = Array.from(uniqueMap.values())
            .sort((a, b) => {
                if (b.urgency !== a.urgency) return b.urgency - a.urgency;
                return new Date(b.date) - new Date(a.date);
            })
            .slice(0, 150);

        fs.writeFileSync(newsFilePath, JSON.stringify(finalNews, null, 2));
        console.log(`✅ Success! Update Engine stabilized with ${finalNews.length} verified signals.`);
        
    } catch (err) {
        console.error("❌ Refresh failed:", err.message);
    }
}

forceRefresh();
