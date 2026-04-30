#!/usr/bin/env node

/**
 * MCC Batch 2 Executor (Phase 109C)
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    const passBatch = await fs.readJson('e:/CMAT-PROBLEM/cei-extractors/output/mcc_batch_2_audit.json');

    console.log(`Promoting ${passBatch.length} medical nodes...`);

    for (const node of passBatch) {
        await db.collection('institutions').updateOne(
            { institution_id: node.institution_id },
            { $set: { 
                institution_name: node.longName, 
                isVisible: true, 
                status: 'PROMOTED_MEDICAL_TRUTH',
                verification_note: "Identity verified via MCC 2025 official registry"
            }}
        );
        console.log(`[PROMOTED] ${node.longName}`);
    }

    await client.close();
}

main().catch(console.error);
