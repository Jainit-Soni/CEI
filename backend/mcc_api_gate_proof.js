/**
 * MCC API Proof Test Harness (v2)
 */

const mongoose = require('mongoose');
const bridge = require('./services/seatCutoffBridge');

async function main() {
    await mongoose.connect('mongodb://localhost:27017/cei_v2');
    console.log('Connected to DB.');

    const linkedTests = [
        { id: 'CORE-AIIMS-DELHI', name: 'AIIMS Delhi' },
        { id: 'C-6414', name: 'MAMC Delhi' },
        { id: 'CORE-VMMC-DELHI', name: 'VMMC Delhi' },
        { id: 'CORE-ALL-INDIA-INSTITUTE-OF-MEDICAL-SCIENCES-JODHPUR', name: 'AIIMS Jodhpur' },
        { id: 'C-6816', name: 'BJMC Ahmedabad' },
        { id: 'C-45402', name: 'Madras Medical College' },
        { id: 'S-3530', name: 'KGMU Lucknow' },
        { id: 'C-13787', name: 'Seth GS Mumbai' },
        { id: 'C-13853', name: 'Grant Medical College' },
        { id: 'C-13844', name: 'AFMC Pune' }
    ];

    const unmatchTests = [
        { id: 'NON-EXISTENT-ID', name: 'Fake Institute' },
        { id: 'aicte:1-44638801317', name: 'Engineering College (Unlinked Medical)' }
    ];

    console.log('\n--- PHASE 1: LINKED INSTITUTIONS PROOF ---');
    for (const test of linkedTests) {
        const results = await bridge.getSeatsAndCutoffsForCollege(test.id);
        const compliance = bridge.normalizeComplianceItems(results);
        
        console.log(`\n[${test.name}] ID: ${test.id}`);
        console.log(`- Seats Found: ${results.seats.length}`);
        console.log(`- Cutoffs Found: ${results.cutoffs.length}`);
        
        if (compliance.length > 0) {
            console.log(`- Label: ${compliance[0].displayLabel}`);
            console.log(`- Source: ${compliance[0].source.title}`);
        } else {
            console.log(`- Label: Official Data Unavailable`);
        }
    }

    console.log('\n--- PHASE 2: UNMATCHED/UNLINKED PROOF ---');
    for (const test of unmatchTests) {
        const results = await bridge.getSeatsAndCutoffsForCollege(test.id);
        const compliance = bridge.normalizeComplianceItems(results);
        console.log(`\n[${test.name}] ID: ${test.id}`);
        console.log(`- Status: ${compliance.some(c => c.displayLabel.includes('MCC')) ? 'LEAK DETECTED' : 'OFFICIAL_DATA_UNAVAILABLE'}`);
    }

    await mongoose.disconnect();
}

main().catch(console.error);
