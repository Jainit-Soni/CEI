#!/usr/bin/env node

/**
 * MCC Duplicate Risk Auditor (Refined)
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    const reg = await fs.readJson('e:/CMAT-PROBLEM/backend/data/truth/medical_identity_registry.json');
    const linkedIds = Array.from(new Set(reg.filter(r => r.linkStatus === 'LINKED').map(r => r.targetId)));

    const nodes = await db.collection('institutions').find({ 
        institution_id: { $in: linkedIds },
        isVisible: true
    }).toArray();

    const counts = {};
    nodes.forEach(n => {
        const key = `${n.institution_name.toUpperCase()}||${n.state_name}`;
        if (!counts[key]) counts[key] = [];
        counts[key].push(n.institution_id);
    });

    const dupes = Object.entries(counts).filter(e => e[1].length > 1);
    
    console.log('\n--- Phase 2: Duplicate Risk Check ---');
    console.log(`Visible Linked Institutions: ${nodes.length}`);
    console.log(`Unique Names: ${Object.keys(counts).length}`);
    console.log(`Duplicate Pairs Found: ${dupes.length}`);

    if (dupes.length > 0) {
        console.table(dupes.map(d => ({ Name: d[0], IDs: d[1].join(', ') })));
    } else {
        console.log('[PASS] No name+state collisions detected in the public cohort.');
    }

    await client.close();
}

main().catch(console.error);
