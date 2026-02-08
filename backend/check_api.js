const http = require('http');

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: "Invalid JSON", raw: data }); // Resolve with raw data on error
                }
            });
        }).on('error', reject);
    });
}

async function check() {
    try {
        console.log("Checking /api/colleges...");
        const colleges = await get('http://localhost:4000/api/colleges?page=1&limit=5');
        console.log("Colleges Status:", colleges.data ? "Array" : "Object");
        console.log("Colleges Count:", colleges.data ? colleges.data.length : "N/A");
        if (colleges.pagination) console.log("Pagination:", colleges.pagination);

        console.log("\nChecking /api/exams...");
        const exams = await get('http://localhost:4000/api/exams');
        const examList = Array.isArray(exams) ? exams : (exams.data || []);
        console.log("Exams Count:", examList.length);
        console.log("Exams Type:", Array.isArray(exams) ? "Array" : "Object");

    } catch (err) {
        console.error("Error:", err.message);
    }
}

check();
