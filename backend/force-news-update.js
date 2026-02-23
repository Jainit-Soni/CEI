const axios = require("axios");
const fs = require("fs");
const path = require("path");

const newsFilePath = path.join(__dirname, "models/news.json");

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

async function forceUpdate() {
    console.log("🚀 Force updating news.json from RSS...");
    try {
        const currentData = JSON.parse(fs.readFileSync(newsFilePath, "utf8"));
        const response = await axios.get('https://news.google.com/rss/search?q=MBA+Entrance+Exams+India+admission+CAT+CMAT+NEET+JEE+admissions', { timeout: 10000 });
        const rssItems = parseRSS(response.data);

        console.log(`📡 Fetched ${rssItems.length} items from RSS.`);

        const normalizeTitle = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 60);
        const existingTitles = new Set(currentData.map(n => normalizeTitle(n.title)));

        const newItems = rssItems.filter(item => !existingTitles.has(normalizeTitle(item.title)));

        if (newItems.length > 0) {
            const updatedNews = [...newItems, ...currentData].slice(0, 100);
            fs.writeFileSync(newsFilePath, JSON.stringify(updatedNews, null, 2));
            console.log(`✅ Success! Added ${newItems.length} new items. total count: ${updatedNews.length}`);
        } else {
            console.log("ℹ️ No new items found.");
        }
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

forceUpdate();
