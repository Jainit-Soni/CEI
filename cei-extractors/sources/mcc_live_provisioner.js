#!/usr/bin/env node

/**
 * MCC Safe Provisioner (Phase 108C)
 * ================================
 * Creates hidden catalog nodes and links medical truth.
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

const AUDITED_PATH = 'e:/CMAT-PROBLEM/cei-extractors/output/mcc_auto_provision_candidates_audited.ndjson';
const REGISTRY_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_identity_registry.json';
const MONGO_URI = 'mongodb://localhost:27017';

async function main() {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db('cei_v2');

    const audited = fs.readFileSync(AUDITED_PATH, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const safe = audited.filter(a => a.status === 'SAFE_TO_PROVISION');

    console.log(`Provisioning ${safe.length} hidden nodes...`);

    const provisionedCount = 0;
    const registry = await fs.readJson(REGISTRY_PATH);

    for (const entry of safe) {
        const p = entry.proposed_node;
        
        // 1. Create Node in institutions collection
        const newNode = {
            institution_id: p.institution_id,
            institution_name: p.institution_name,
            state_name: p.state,
            stable_import_key: `MCC||PROVISIONED||${p.mcc_id}`,
            authority: 'MCC',
            source_record_type: 'mcc_auto_provisioned',
            status: 'PENDING_VERIFICATION',
            isVisible: false,
            verificationStatus: 'OFFICIAL_SOURCE_ONLY',
            mcc_id: p.mcc_id,
            ingested_at: new Date()
        };

        await db.collection('institutions').updateOne(
            { institution_id: p.institution_id },
            { $set: newNode },
            { upsert: true }
        );

        // 2. Update Medical Identity Registry to link this MCC ID to the new Node
        // We need to update ALL occurrences of this mccId in the registry to this new targetId
        registry.forEach(r => {
            if (r.mccId === p.mcc_id) {
                r.targetId = p.institution_id;
                r.targetName = p.institution_name;
                r.linkStatus = 'LINKED';
                r.linkReason = 'Auto-Provisioned (Hidden)';
            }
        });
    }

    // Save updated registry
    await fs.writeJson(REGISTRY_PATH, registry, { spaces: 2 });
    console.log(`Updated ${safe.length} registry links.`);

    // 3. Re-run rehydration to propagate truth to new IDs
    console.log('Propagating truth to new nodes...');
    // I'll call the rehydrate script after this.

    await client.close();
}

main().catch(console.error);
