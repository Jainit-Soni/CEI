const fs = require('fs');
const axios = require('axios');

async function audit() {
    const raw = fs.readFileSync('E:/CMAT-PROBLEM/backend/models/scholarships.json', 'utf8');
    const scholarships = JSON.parse(raw);
    console.log(`Auditing ${scholarships.length} scholarships...`);

    const results = [];
    for (const s of scholarships) {
        try {
            console.log(`Checking: ${s.name} -> ${s.applicationUrl}`);
            const res = await axios.get(s.applicationUrl, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (res.status >= 400) {
                results.push({ id: s.id, name: s.name, url: s.applicationUrl, status: res.status });
            }
        } catch (err) {
            results.push({ id: s.id, name: s.name, url: s.applicationUrl, error: err.message });
        }
    }

    console.log('\n--- Audit Results (Potential Broken Links) ---');
    console.log(JSON.stringify(results, null, 2));
}

audit();
