/**
 * backend/scripts/test_identity_enforcement.js
 * ===========================================
 * Validates that the identity enforcement layer correctly resolves
 * verbose and variant names into canonical short-form IDs.
 */

const identityEnforcement = require('../lib/identityEnforcement');

const testCases = [
    { name: "Indian Institute of Technology Delhi", expected: "CORE-IIT-DELHI" },
    { name: "IIT Delhi", expected: "CORE-IIT-DELHI" },
    { name: "Indian Institute of Technology, Kanpur", expected: "CORE-IIT-KANPUR" },
    { name: "IIT Kanpur", expected: "CORE-IIT-KANPUR" },
    { name: "Indian Institute of Technology, Kharagpur", expected: "CORE-IIT-KHARAGPUR" },
    { name: "Indian Institute of Technology Mumbai", expected: "CORE-IIT-BOMBAY" },
    { name: "IIT Bombay", expected: "CORE-IIT-BOMBAY" },
    { name: "National Institute of Technology Trichy", expected: "CORE-NIT-TRICHY" },
    { name: "NIT Surathkal", expected: "CORE-NIT-SURATHKAL" },
    { name: "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-DELHI", expected: "CORE-IIT-DELHI" },
    { name: "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-TRICHY", expected: "CORE-NIT-TRICHY" },
    { name: "Indian Institute of Information Technology Allahabad", expected: "CORE-IIIT-ALLAHABAD" }
];

console.log("=== IDENTITY ENFORCEMENT VALIDATION ===");

let passedCount = 0;

for (const tc of testCases) {
    const resolved = identityEnforcement.resolveCanonicalId(tc.name);
    const pass = resolved === tc.expected;
    if (pass) {
        console.log(`✅ [PASS] "${tc.name}" -> ${resolved}`);
        passedCount++;
    } else {
        console.error(`❌ [FAIL] "${tc.name}" -> ${resolved} (Expected: ${tc.expected})`);
    }
}

console.log(`\nResults: ${passedCount}/${testCases.length} Passed`);

if (passedCount === testCases.length) {
    console.log("🚀 IDENTITY ENFORCEMENT IS FULLY DETERMINISTIC.");
} else {
    process.exit(1);
}
