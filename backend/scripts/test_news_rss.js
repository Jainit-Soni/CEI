const axios = require('axios');

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
                title: title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim(),
                pubDate,
                date: new Date(pubDate).toISOString(),
                url: link
            });
        }
    }
    return items;
}

async function testRSS() {
    try {
        console.log("Fetching RSS...");
        const response = await axios.get('https://news.google.com/rss/search?q=MBA+Entrance+Exams+India+admission+CAT+CMAT+NEET+JEE+admissions', { timeout: 8000 });
        const items = parseRSS(response.data);
        console.log(`Found ${items.length} items.`);
        items.slice(0, 5).forEach(item => {
            console.log(`- ${item.title} (${item.date})`);
        });
    } catch (err) {
        console.error("Error:", err.message);
    }
}

testRSS();
