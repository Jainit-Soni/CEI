#!/usr/bin/env node

/**
 * MCC Route & UI Certifier (Phase 109G)
 */

const bridge = require('./services/seatCutoffBridge');
const mongoose = require('mongoose');
const fs = require('fs-extra');

async function main() {
    await mongoose.connect('mongodb://localhost:27017/cei_v2');
    
    const baseline = await fs.readJson('e:/CMAT-PROBLEM/backend/data/truth/medical_public_baseline_v1.json');
    const db = mongoose.connection.db;

    const heldNodes = await db.collection('institutions').find({ 
        status: 'PENDING_PROMOTION_AUDIT',
        isVisible: false
    }).limit(5).toArray();

    console.log(`\n--- Phase 3: Route + UI Certification ---`);

    console.log(`\n[CERTIFYING 10 PUBLIC NODES]`);
    const publicSample = baseline.slice(0, 10);
    for (const node of publicSample) {
        try {
            const results = await bridge.getSeatsAndCutoffsForCollege(node.institution_id);
            const compliance = bridge.normalizeComplianceItems(results);
            const isLinked = results.metadata.medical_link_status === 'LINKED';
            const hasLabels = compliance.some(c => c.displayLabel.includes('MCC Official Data') && c.value.includes('MCC AIQ'));
            console.log(`- ${node.displayName} (ID: ${node.institution_id})`);
            console.log(`  Route: ${isLinked ? 'OK' : 'FAIL'} | Labels: ${hasLabels ? 'OK' : 'FAIL'}`);
        } catch (e) {
            console.log(`- ${node.displayName} (ID: ${node.institution_id}) -> Route ERROR`);
        }
    }

    console.log(`\n[CERTIFYING 5 HELD NODES]`);
    for (const node of heldNodes) {
        console.log(`- ${node.institution_name} (ID: ${node.institution_id})`);
        console.log(`  Visibility: ${node.isVisible === false ? 'HIDDEN (OK)' : 'VISIBLE (FAIL)'}`);
        // Held nodes might still route if called directly by ID, which is OK for deep links but shouldn't be publicly discoverable.
        const results = await bridge.getSeatsAndCutoffsForCollege(node.institution_id);
        const isLinked = results.metadata.medical_link_status === 'LINKED';
        console.log(`  Deep Link Routing: ${isLinked ? 'OK (Internal Truth preserved)' : 'FAIL'}`);
    }

    await mongoose.disconnect();
}

main().catch(console.error);
