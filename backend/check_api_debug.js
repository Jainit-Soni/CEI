const http = require('http');

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        }).on('error', reject);
    });
}

async function check() {
    try {
        console.log("Checking /api/colleges...");
        const res = await get('http://localhost:4000/api/colleges?page=1&limit=5');
        console.log("Status:", res.status);
        console.log("Body:", JSON.stringify(res.body, null, 2));

    } catch (err) {
        console.error("Error:", err.message);
    }
}

check();
