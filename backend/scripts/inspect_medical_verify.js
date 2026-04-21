const axios = require('axios');
require('dotenv').config({ path: 'backend/.env.local' });

async function run() {
    try {
        const id = 'CORE-ALL-INDIA-INSTITUTE-OF-MEDICAL-SCIENCES-NEW-DELHI';
        const url = `http://localhost:4000/api/verified/${id}`;
        console.log(`Checking ${url}...`);
        const res = await axios.get(url);
        console.log('--- Response ---');
        console.log(JSON.stringify(res.data, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

run();
