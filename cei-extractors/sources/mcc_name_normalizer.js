#!/usr/bin/env node

/**
 * MCC Name Normalizer (Phase 109B)
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    const reg = await fs.readJson('e:/CMAT-PROBLEM/backend/data/truth/medical_identity_registry.json');
    const promoted = await db.collection('institutions').find({ status: 'PROMOTED_MEDICAL_TRUTH' }).toArray();

    for (const node of promoted) {
        const r = reg.find(entry => entry.targetId === node.institution_id);
        if (r) {
            // Take the first two parts of the MCC name for clarity
            const parts = r.rawName.split(',');
            const longName = (parts[0] + (parts[1] ? ', ' + parts[1] : '')).trim();
            
            await db.collection('institutions').updateOne(
                { _id: node._id },
                { $set: { 
                    institution_name: longName, 
                    canonical_name: node.institution_name,
                    verification_note: "Identity verified via MCC 2025 official registry"
                }}
            );
            console.log(`[NORMALIZED] ${node.institution_name} -> ${longName}`);
        }
    }

    await client.close();
}

main().catch(console.error);
