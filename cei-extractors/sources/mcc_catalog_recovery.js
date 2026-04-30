#!/usr/bin/env node

/**
 * MCC Catalog Recovery (Phase 109D)
 * =================================
 * Provisions missing nodes for all LINKED IDs in the registry.
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    const reg = await fs.readJson('e:/CMAT-PROBLEM/backend/data/truth/medical_identity_registry.json');
    const linked = reg.filter(r => r.linkStatus === 'LINKED');

    console.log(`Auditing catalog for ${linked.length} linked entries...`);

    let provisionedCount = 0;
    for (const entry of linked) {
        const exists = await db.collection('institutions').findOne({ institution_id: entry.targetId });
        
        if (!exists) {
            // Provision the missing node
            const newNode = {
                institution_id: entry.targetId,
                institution_name: entry.targetName || entry.rawName.split(',')[0],
                stable_import_key: `MCC||RECOVERY||${entry.targetId}||${entry.mccId}`,
                authority: 'MCC',
                source_record_type: 'mcc_catalog_recovery',
                status: 'LINKED_MEDICAL_TRUTH',
                isVisible: true,
                verificationStatus: 'OFFICIAL_SOURCE_ONLY',
                mcc_id: entry.mccId,
                ingested_at: new Date(),
                ux_standard: '109D'
            };

            await db.collection('institutions').insertOne(newNode);
            provisionedCount++;
            console.log(`[RECOVERED] ${newNode.institution_name} (${entry.targetId})`);
        }
    }

    console.log(`Total nodes recovered: ${provisionedCount}`);
    await client.close();
}

main().catch(console.error);
