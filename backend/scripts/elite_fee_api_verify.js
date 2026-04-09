const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3010/api'; // Standard backend port
const SAMPLES = [
    { id: 'CORE-INDIANINSTITUTEOFTECHNOLOGYBOMBAY', name: 'IIT Bombay' },
    { id: 'CORE-INDIANINSTITUTEOFTECHNOLOGYMADRAS', name: 'IIT Madras' },
    { id: 'CORE-INDIANINSTITUTEOFMANAGEMENTCALCUTTA', name: 'IIM Calcutta' }
];

async function verify() {
    process.stdout.write('Starting Elite Fee API Verification...\n');
    const results = [];

    for (const sample of SAMPLES) {
        try {
            const response = await axios.get(`${API_BASE}/colleges/${sample.id}`);
            const college = response.data;
            const feeData = college.fees;

            const isCorrect = feeData && feeData.isVerified === true && feeData.totalNumeric > 0;
            
            results.push({
                id: sample.id,
                name: sample.name,
                status: isCorrect ? '✅ PASS' : '❌ FAIL',
                feeResponse: feeData
            });
        } catch (err) {
            results.push({
                id: sample.id,
                name: sample.name,
                status: '❌ ERROR',
                error: err.message
            });
        }
    }

    const reportPath = path.join(__dirname, '../reports/fees/elite_fee_api_verification.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log('API Verification Complete. Results saved to backend/reports/fees/');
    console.table(results.map(r => ({ Name: r.name, Status: r.status, Fee: r.feeResponse?.total || 'N/A' })));
}

verify().catch(console.error);
