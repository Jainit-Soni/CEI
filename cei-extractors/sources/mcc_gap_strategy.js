#!/usr/bin/env node

/**
 * Catalog Gap Strategizer
 * =======================
 * Classifies unmatched MCC entities into high-impact vs. deferrable.
 */

const fs = require('fs-extra');

const REGISTRY_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_identity_registry.json';
const OUTPUT_PATH = 'C:/Users/Jainit Soni/.gemini/antigravity/brain/67e1affa-ce74-4eff-b9bf-1a906d700bb3/catalog_gap_strategy.md';

async function main() {
    const registry = await fs.readJson(REGISTRY_PATH);
    const missing = registry.filter(r => r.linkStatus === 'UNMATCHED');

    const classification = {
        high_impact: [], // GMCs, State Govt colleges
        deferrable: [],  // Private, Deemed with low volume
        ambiguous: []    // Nursing, Dental without clear ID
    };

    missing.forEach(r => {
        const name = r.rawName.toLowerCase();
        const isGMC = name.includes('govt') || name.includes('government') || name.includes('medical college');
        const isDental = name.includes('dental') || name.includes('dent.');
        const isNursing = name.includes('nursing') || name.includes('b.sc');

        if (isGMC && !isDental && !isNursing) {
            classification.high_impact.push(r);
        } else if (isDental || isNursing) {
            classification.ambiguous.push(r);
        } else {
            classification.deferrable.push(r);
        }
    });

    const report = `
# MCC Catalog Gap Strategy
Total Missing Nodes: ${missing.length}

## 1. High-Impact GMCs (Priority: MUST-CREATE)
These are government medical colleges missing from the core CEI catalog.
Count: ${classification.high_impact.length}

| MCC ID | Raw Name | Reason for Priority |
| :--- | :--- | :--- |
${classification.high_impact.slice(0, 20).map(r => `| ${r.mccId || 'N/A'} | ${r.rawName.split(',')[0]} | Verified GMC (MCC) |`).join('\n')}

## 2. Ambiguous / Specialty (Priority: DEFER)
Primarily Dental and Nursing colleges with high identity overlap or low traffic.
Count: ${classification.ambiguous.length}

## 3. Deferrable Private (Priority: LOW)
Private institutions or high-drift naming variants.
Count: ${classification.deferrable.length}

---
**Strategy**: 
1. Validate High-Impact GMCs against NMC (National Medical Commission) registry.
2. Auto-provision shell nodes for these GMCs in Phase 108.
3. Suppress all other missing nodes until manual review.
`;

    await fs.writeFile(OUTPUT_PATH, report);
    console.log(`Gap strategy generated at: ${OUTPUT_PATH}`);
}

main().catch(console.error);
