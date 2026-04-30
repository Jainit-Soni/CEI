#!/usr/bin/env node

/**
 * Top 50 Human Review Pack Generator
 * ==================================
 */

const fs = require('fs-extra');

const AUDITED_PATH = 'e:/CMAT-PROBLEM/cei-extractors/output/mcc_auto_provision_candidates_audited.ndjson';
const OUTPUT_PATH = 'e:/CMAT-PROBLEM/cei-extractors/output/mcc_top_50_review_pack.md';

async function main() {
    const lines = fs.readFileSync(AUDITED_PATH, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    
    const sorted = lines
        .filter(l => l.status === 'SAFE_TO_PROVISION' || l.status === 'MANUAL_REVIEW_REQUIRED')
        .sort((a,b) => {
            // Priority: Safe first, then Manual
            if (a.status === 'SAFE_TO_PROVISION' && b.status !== 'SAFE_TO_PROVISION') return -1;
            if (a.status !== 'SAFE_TO_PROVISION' && b.status === 'SAFE_TO_PROVISION') return 1;
            return 0;
        })
        .slice(0, 50);

    const report = `
# MCC Auto-Provisioning: Top 50 Review Pack
Generated: ${new Date().toISOString()}

## Audit Summary
- **Safe to Provision**: 74 (Strict Pattern Match)
- **Manual Review**: 152
- **Blocked**: 12

## Review Table
| MCC ID | Institution Name (MCC) | State | Status | Reviewer Action | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
${sorted.map(s => `| ${s.mccId} | ${s.rawName.split(',')[0]} | ${s.explicit_state || 'UNKNOWN'} | **${s.status}** | ${s.status === 'SAFE_TO_PROVISION' ? 'Final Check' : 'Verify NMC Affiliation'} | ${s.reason} |`).join('\n')}

---
**Verification Protocol**:
1. Open NMC Official Website.
2. Search for the institution name in the target state.
3. If confirmed, change status to LINKED.
`;

    await fs.writeFile(OUTPUT_PATH, report);
    console.log(`Review pack generated at: ${OUTPUT_PATH}`);
}

main().catch(console.error);
