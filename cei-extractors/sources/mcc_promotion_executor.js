#!/usr/bin/env node

/**
 * MCC Selective Promotion Executor (Phase 109)
 * ===========================================
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    const audit = await fs.readJson('e:/CMAT-PROBLEM/cei-extractors/output/mcc_promotion_audit.json');
    const toPromote = audit.filter(a => a.auditStatus === 'PASS' && !a.name.includes('Reported'));

    console.log(`Promoting ${toPromote.length} medical nodes...`);

    for (const node of toPromote) {
        await db.collection('institutions').updateOne(
            { institution_id: node.institution_id },
            { $set: { isVisible: true, status: 'PROMOTED_MEDICAL_TRUTH' } }
        );
        console.log(`[PROMOTED] ${node.name}`);
    }

    await client.close();
}

main().catch(console.error);
