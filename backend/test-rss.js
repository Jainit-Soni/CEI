const axios = require('axios');

async function test() {
    console.log("Testing RSS fetch...");
    try {
        const response = await axios.get('https://news.google.com/rss/search?q=MBA+Entrance+Exams+India+admission+CAT+CMAT+NEET+JEE', { timeout: 5000 });
        console.log("Success! Data length:", response.data.length);
        const itemMatch = response.data.match(/<item>/g);
        console.log("Found items:", itemMatch ? itemMatch.length : 0);
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

test();
