const axios = require('axios');

async function run() {
    try {
        const id = 'CORE-IIT-BOMBAY';
        const urls = [
            `http://localhost:4000/api/colleges/${id}/truth/compliance`,
            `http://localhost:4000/api/college/${id}/benchmarks`
        ];
        
        for (const url of urls) {
            console.log(`Checking ${url}...`);
            try {
                const res = await axios.get(url);
                console.log(`  -> SUCCESS (HTTP ${res.status})`);
            } catch (e) {
                console.log(`  -> FAILED (HTTP ${e.response?.status}): ${e.message}`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

run();
