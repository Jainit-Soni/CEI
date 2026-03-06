/**
 * scripts/testEndpoints.js — CEI Final Stability Check
 * ==============================================================
 * Tests the Health, Public, and Protected endpoints to verify
 * production readiness.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const jwt = require('jsonwebtoken');
const http = require('http');

if (!process.env.JWT_SECRET) {
    console.error('❌ FAIL: JWT_SECRET is not set in environment.');
    process.exit(1);
}

const token = jwt.sign({ sub: 'test_admin', role: 'super_admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

const request = (path, headers = {}) => new Promise((resolve) => {
    http.get(`http://localhost:4000${path}`, { headers }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', (e) => resolve({ status: 500, body: e.message }));
});

async function run() {
    console.log("🧪 Running Final CEI Production Readiness Test\n");

    console.log("1️⃣ Hit Health Endpoint (/api/health)");
    const h = await request('/api/health');
    console.log(`   Status: ${h.status}`);

    console.log("\n2️⃣ Hit Public Endpoint (/api/v1/institution/iit-bombay)");
    const p = await request('/api/v1/institution/iit-bombay');
    console.log(`   Status: ${p.status}`);

    console.log("\n3️⃣ Hit Protected Endpoint (/api/evidence/iit-bombay/full)");
    const pr = await request('/api/evidence/iit-bombay/full', { Authorization: `Bearer ${token}` });
    console.log(`   Status: ${pr.status}`);

    console.log('\n------------------------------------------------');
    if (h.status === 200 && p.status === 200 && pr.status === 200) {
        console.log("✅ ALL ENDPOINTS VERIFIED. PRODUCTION IS STABLE.");
    } else {
        console.log("❌ SOME ENDPOINTS FAILED. CHECK LOGS.");
    }
    console.log('------------------------------------------------');
}

run();
