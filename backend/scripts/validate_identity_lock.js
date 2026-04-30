/**
 * validate_identity_lock.js
 *
 * Validates the Identity Registry Authority Layer.
 */

const identityEnforcement = require('../lib/identityEnforcement');

const testCases = [
    { name: "Indian Institute of Technology Bombay", expected: "CORE-IIT-BOMBAY" },
    { name: "IIT Mumbai", expected: "CORE-IIT-BOMBAY" },
    { name: "National Institute of Technology, Tiruchirappalli", expected: "CORE-NIT-TRICHY" },
    { name: "NIT Trichy", expected: "CORE-NIT-TRICHY" },
    { name: "Non-Existent College", expected: "Non-Existent College" }
];

console.log('🧪 Testing Identity Lock System...');
let passed = 0;

testCases.forEach(tc => {
    const resolved = identityEnforcement.resolveCanonicalId(tc.name);
    if (resolved === tc.expected) {
        console.log(`✅ [PASS] "${tc.name}" -> ${resolved}`);
        passed++;
    } else {
        console.log(`❌ [FAIL] "${tc.name}" -> ${resolved} (Expected: ${tc.expected})`);
    }
});

console.log('\n🧪 Testing Ingestion Hook...');
const hookTest = identityEnforcement.validateForIngestion("Indian Institute of Technology Bombay", "Maharashtra");
if (!hookTest.canInsert && hookTest.existingId === "CORE-IIT-BOMBAY") {
    console.log(`✅ [PASS] Ingestion blocked for locked identity: ${hookTest.existingId}`);
    passed++;
} else {
    console.log(`❌ [FAIL] Ingestion hook failed: ${JSON.stringify(hookTest)}`);
}

console.log(`\nFinal Score: ${passed}/${testCases.length + 1}`);
process.exit(passed === testCases.length + 1 ? 0 : 1);
