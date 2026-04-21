const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });
const axios = require('axios');

async function run() {
    try {
        console.log('--- CEI Identity State Inspector ---');
        // We can't access global.colleges directly from outside, 
        // so we probe the search API or equivalent.
        
        const id = 'CORE-IIT-BOMBAY';
        const url = `http://localhost:4000/api/colleges/${id}`;
        console.log(`Checking ${url}...`);
        const res = await axios.get(url);
        console.log('--- Response ---');
        console.log(`ID: ${res.data.id}`);
        console.log(`Name: ${res.data.name}`);
        process.exit(0);
    } catch (err) {
        console.error(`FAILED: ${err.response?.status} - ${err.message}`);
        process.exit(1);
    }
}

run();
