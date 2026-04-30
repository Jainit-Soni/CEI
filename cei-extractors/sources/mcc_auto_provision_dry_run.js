#!/usr/bin/env node

/**
 * MCC Auto-Provision Dry Run (Phase 108)
 * =====================================
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

const REGISTRY_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_identity_registry.json';
const OUTPUT_PATH = 'e:/CMAT-PROBLEM/cei-extractors/output/medical_auto_provision_candidates.ndjson';

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const dbV2 = client.db('cei_v2');

    const registry = await fs.readJson(REGISTRY_PATH);
    const unmatched = registry.filter(r => r.linkStatus === 'UNMATCHED');

    const candidates = [];
    const summary = { safe: 0, review: 0, blocked: 0 };

    console.log('Running Collision Dry Run...');

    for (const entry of unmatched) {
        if (!entry.mccId) continue;
        const name = entry.rawName.toUpperCase();
        
        // Filter for GMC candidates
        const isGMC = (name.includes('GOVT') || name.includes('GOVERNMENT') || name.includes('MEDICAL COLLEGE')) && 
                      !name.includes('DENTAL') && !name.includes('NURSING') && !name.includes('PRIVATE');

        if (!isGMC) continue;

        // 1. Check for Name+State Collision in DB
        const cleanName = normalize(entry.rawName);
        const collision = await dbV2.collection('institutions').findOne({ 
            institution_name: { $regex: cleanName, $options: 'i' }
        });

        const status = collision ? 'BLOCKED' : 'SAFE_TO_PROVISION';
        const reason = collision ? `Collision with existing node: ${collision.institution_id}` : 'No collision found';
        const state = inferState(name);

        const node = {
            mccId: entry.mccId,
            rawName: entry.rawName,
            status: status,
            reason: reason,
            proposed_node: status === 'SAFE_TO_PROVISION' ? {
                institution_id: `MCC-GMC-${entry.mccId}`,
                institution_name: `${entry.rawName.split(',')[0]} (${state})`,
                state: state,
                mcc_id: entry.mccId,
                source_record_type: 'mcc_auto_provisioned',
                status: 'PENDING_VERIFICATION',
                isVisible: false
            } : null
        };

        candidates.push(node);
        if (status === 'SAFE_TO_PROVISION') summary.safe++;
        else summary.blocked++;
    }

    // Write review pack
    const ndjson = candidates.map(c => JSON.stringify(c)).join('\n');
    await fs.writeFile(OUTPUT_PATH, ndjson);

    console.log(`\n--- Phase 108 Results ---`);
    console.log(`Safe to Provision: ${summary.safe}`);
    console.log(`Blocked (Collisions): ${summary.blocked}`);
    console.log(`Manual Review Req: ${summary.review}`);
    console.log(`Review Pack saved to: ${OUTPUT_PATH}`);

    await client.close();
}

function normalize(s) {
    return String(s || '').split(',')[0].trim();
}

function inferState(s) {
    const states = ["ANDHRA", "ARUNACHAL", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL", "TELANGANA", "TRIPURA", "UTTAR", "UTTARAKHAND", "WEST BENGAL", "DELHI", "PUDUCHERRY"];
    for (const st of states) {
        if (s.includes(st)) return st;
    }
    return "UNKNOWN";
}

main().catch(console.error);
