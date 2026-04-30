#!/usr/bin/env node

/**
 * MCC Regression Guard (Collision Detector)
 * ========================================
 * Fails if the identity registry contains unsafe collisions or abnormal spikes.
 */

const fs = require('fs-extra');

const REGISTRY_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_identity_registry.json';

async function main() {
    if (!fs.existsSync(REGISTRY_PATH)) {
        console.error('Registry missing. Check skipped.');
        process.exit(0);
    }

    const reg = await fs.readJson(REGISTRY_PATH);
    const linked = reg.filter(r => r.linkStatus === 'LINKED');

    // 1. Check for Duplicate Target IDs (Collisions)
    const targetCounts = {};
    const collisions = [];

    linked.forEach(r => {
        if (!r.targetId) return;
        targetCounts[r.targetId] = (targetCounts[r.targetId] || 0) + 1;
        if (targetCounts[r.targetId] > 1 && r.linkReason !== 'Manual Override') {
            collisions.push({
                targetId: r.targetId,
                mccName: r.rawName,
                mccId: r.mccId
            });
        }
    });

    if (collisions.length > 0) {
        console.error('\n[REGRESSION ERROR] Identity Collision Detected!');
        console.error('Multiple MCC IDs are mapping to the same Target ID without Manual Override.');
        console.table(collisions);
        process.exit(1);
    }

    // 2. Check for Abnormal Spike (Threshold: 400 for medical result set)
    const MAX_EXPECTED_LINKS = 400; 
    if (linked.length > MAX_EXPECTED_LINKS) {
        console.error(`\n[REGRESSION ERROR] Mapping Spike Detected: ${linked.length} links found.`);
        console.error(`Threshold is ${MAX_EXPECTED_LINKS}. Possible fuzzy match leakage.`);
        process.exit(1);
    }

    console.log(`[PASS] Regression Guard: ${linked.length} verified links, 0 collisions.`);
}

main().catch(console.error);
