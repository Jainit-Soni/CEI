const axios = require('axios');
const assert = require('node:assert');

const BASE_URL = process.env.API_URL || 'http://localhost:4000/api';
const SAMPLES = [
    { id: 'U-0456', name: 'IIT Madras', expectedRank: 2 },
    { id: 'U-0517', name: 'IIT Kanpur', expectedRank: 2 },
    { id: 'U-0100', name: 'IIT Delhi', expectedRank: 2 }
];

async function runTests() {
    console.log("🧪 Starting NIRF 2024 API Contract Hardening Tests...");
    let passed = 0;
    let failed = 0;

    for (const sample of SAMPLES) {
        try {
            console.log(`\n🔍 Testing Sample: ${sample.name} (${sample.id})`);

            // 1. Test College Detail API
            const collegeRes = await axios.get(`${BASE_URL}/college/${sample.id}`);
            const college = collegeRes.data.college || collegeRes.data; // Handle different wrapping

            assert.ok(college.rankings, "Rankings array missing");
            const nirf2024 = college.rankings.filter(r => r.source === 'NIRF' && r.year === '2024');
            assert.ok(nirf2024.length > 0, "NIRF 2024 rankings missing in detail API");
            
            // Verify Category presence
            nirf2024.forEach(r => {
                assert.ok(r.category, `Category missing for NIRF rank: ${r.rank}`);
                console.log(`   ✅ Ranking Found: ${r.category} #${r.rank}`);
            });

            // 2. Test Truth Placements API
            const placementRes = await axios.get(`${BASE_URL}/colleges/${sample.id}/truth/placements`);
            const placementData = placementRes.data;

            assert.strictEqual(placementData.sectionStatus, 'available', "Placements section should be available");
            const nirfItem = (placementData.items || []).find(item => item.source?.title === 'NIRF 2024');
            
            assert.ok(nirfItem, "NIRF 2024 placement item missing in truth API");
            assert.ok(nirfItem.value.includes('LPA'), "Placement value should be formatted as LPA");
            assert.ok(nirfItem.applicableBatchYear, "applicableBatchYear missing");
            
            console.log(`   ✅ Placement Found: ${nirfItem.value} (${nirfItem.applicableBatchYear})`);
            passed++;
        } catch (err) {
            console.error(`❌ Test Failed for ${sample.name}:`, err.message);
            if (err.response) console.error("   Response Data:", JSON.stringify(err.response.data));
            failed++;
        }
    }

    // 3. Test Negative Case (Non-NIRF college)
    try {
        console.log(`\n🔍 Testing Negative Case: U-0001 (Non-NIRF)`);
        const negRes = await axios.get(`${BASE_URL}/colleges/U-0001/truth/placements`);
        assert.strictEqual(negRes.data.sectionStatus, 'official_data_unavailable', "Non-NIRF college should show unavailable");
        console.log(`   ✅ Negative Case Passed (Clean handle)`);
        passed++;
    } catch (err) {
        console.error(`❌ Negative Case Failed:`, err.message);
        failed++;
    }

    console.log(`\n📊 Test Summary: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
