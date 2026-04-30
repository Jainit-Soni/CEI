#!/usr/bin/env node

/**
 * MCC Selective Demotion (Phase 109E)
 * ==================================
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    const audit = await fs.readJson('e:/CMAT-PROBLEM/cei-extractors/output/mcc_integrity_audit.json');
    const toDemote = audit.filter(a => a.status === 'PARTIALLY_HARDENED');

    console.log(`Demoting ${toDemote.length} nodes to internal-only status...`);

    for (const node of toDemote) {
        await db.collection('institutions').updateOne(
            { institution_id: node.id },
            { $set: { isVisible: false, status: 'PENDING_PROMOTION_AUDIT' } }
        );
        console.log(`[DEMOTED] ${node.name} (ID: ${node.id})`);
    }

    await client.close();
}

main().catch(console.error);
