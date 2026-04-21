const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const PORT = process.env.PORT || 4000;
const BASE_URL = `http://localhost:${PORT}`;

async function runProbes() {
    console.log('--- CEI HTTP Runtime Verifier [E2E Proof] ---');
    console.log(`Target: ${BASE_URL}`);

    try {
        // IDs for verification
        const iitb_id = 'CORE-IIT-BOMBAY';
        const aiims_id = 'CORE-ALL-INDIA-INSTITUTE-OF-MEDICAL-SCIENCES-NEW-DELHI';

        const probes = [
            {
                name: 'Engineering Cutoffs (IITB)',
                url: `${BASE_URL}/api/cutoffs/engineering?institutionId=${iitb_id}&limit=1`,
                assertion: (res) => res.data.items && res.data.items.length > 0
            },
            {
                name: 'Engineering Seat Matrix (IITB)',
                url: `${BASE_URL}/api/seats/engineering?institutionId=${iitb_id}&limit=1`,
                assertion: (res) => res.data.items && res.data.items.length > 0
            },
            {
                name: 'Medical Verified Data (AIIMS)',
                url: `${BASE_URL}/api/verified/${aiims_id}`,
                assertion: (res) => res.data.data && res.data.data.some(f => f.fieldValue === 'vetted')
            }
        ];

        const results = [];
        for (const probe of probes) {
            const start = Date.now();
            try {
                const res = await axios.get(probe.url);
                const passed = probe.assertion(res);
                results.push({
                    Probe: probe.name,
                    Status: res.status,
                    Latency: `${Date.now() - start}ms`,
                    Outcome: passed ? '✅ PASS' : '❌ FAIL (Unexpected Payload)',
                    Size: JSON.stringify(res.data).length
                });
            } catch (err) {
                results.push({
                    Probe: probe.name,
                    Status: err.response?.status || 'ERR',
                    Latency: `${Date.now() - start}ms`,
                    Outcome: `❌ FAIL (${err.message})`,
                    Size: 0
                });
            }
        }

        console.table(results);

        const allPassed = results.every(r => r.Outcome === '✅ PASS');
        if (!allPassed) {
            console.error('\n❌ [FAIL] Runtime protocol verification failed.');
            process.exit(1);
        }

        console.log('\n✅ [SUCCESS] All runtime probes passed. Product path is unified.');
        process.exit(0);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

runProbes();
