#!/usr/bin/env node

/**
 * MCC Identity Registry Builder (State-Strict v5)
 * ==============================================
 * Enforces State + Name match to prevent collisions.
 */

const fs = require('fs-extra');
const path = require('path');
const { MongoClient } = require('mongodb');

const CONFIG = {
    masterPath: 'e:/CMAT-PROBLEM/cei-extractors/output/medical_identity_registry_master.ndjson',
    registryPath: 'e:/CMAT-PROBLEM/backend/data/truth/medical_identity_registry.json',
    overridePath: 'e:/CMAT-PROBLEM/cei-extractors/output/mcc_bridge_audit/mcc_identity_manual_overrides.ndjson',
    mongoUri: 'mongodb://localhost:27017'
};

async function main() {
    const client = new MongoClient(CONFIG.mongoUri);
    await client.connect();
    const dbV2 = client.db('cei_v2');
    const dbLegacy = client.db('cei_legacy');

    console.log('Loading Overrides...');
    const overrides = new Map();
    if (fs.existsSync(CONFIG.overridePath)) {
        const lines = fs.readFileSync(CONFIG.overridePath, 'utf8').split('\n').filter(Boolean);
        lines.forEach(l => {
            const d = JSON.parse(l);
            if (d.mcc_id) overrides.set(d.mcc_id, d);
        });
    }

    console.log('Loading Master Bridge...');
    const masterLines = fs.readFileSync(CONFIG.masterPath, 'utf8').split('\n').filter(Boolean);
    const master = masterLines.map(l => JSON.parse(l));

    console.log('Loading candidates from MongoDB...');
    const v2Pool = await dbV2.collection('institutions').find({}, { projection: { institution_name: 1, institution_id: 1, id: 1, name: 1, state_name: 1, state: 1 } }).toArray();
    const legacyPool = await dbLegacy.collection('colleges').find({}, { projection: { name: 1, id: 1, state: 1 } }).toArray();

    const pool = [
        ...v2Pool.map(x => ({ ...x, source: 'v2', canonicalState: (x.state_name || x.state || '').toLowerCase() })),
        ...legacyPool.map(x => ({ ...x, source: 'legacy', canonicalState: (x.state || '').toLowerCase() }))
    ];

    const registry = [];
    const usedTargetIds = new Set();
    let linked = 0;

    console.log('Mapping with State Strictness...');
    for (const entry of master) {
        let match = null;
        let linkReason = null;

        // 1. Manual Override
        if (entry.mcc_id && overrides.has(entry.mcc_id)) {
            const ovr = overrides.get(entry.mcc_id);
            match = { id: ovr.resolved_target_id, name: ovr.mcc_name_raw, source: 'manual_override' };
            linkReason = 'Manual Override';
        } else {
            // 2. Strict Match
            match = findStrictMatch(entry, pool);
            linkReason = match ? 'Strict Name + State Match' : null;
        }

        const targetId = match ? (match.institution_id || match.id) : null;
        
        // Final Safety: Prevent ID Collisions in Registry
        if (targetId && usedTargetIds.has(targetId) && linkReason !== 'Manual Override') {
            // Collision detected, downgrade to unmatched
            registry.push({
                mccId: entry.mcc_id,
                rawName: entry.result_name_raw,
                targetId: null,
                targetName: null,
                linkStatus: 'UNMATCHED',
                linkReason: 'Collision Prevention (Duplicate Target ID)'
            });
        } else {
            if (targetId) usedTargetIds.add(targetId);
            registry.push({
                mccId: entry.mcc_id,
                rawName: entry.result_name_raw,
                targetId: targetId,
                targetName: match ? (match.institution_name || match.name) : null,
                targetSource: match ? match.source : null,
                linkStatus: match ? 'LINKED' : 'UNMATCHED',
                linkReason: linkReason
            });
            if (match) linked++;
        }
    }

    await fs.writeJson(CONFIG.registryPath, registry, { spaces: 2 });
    console.log(`\nFinal registry saved with ${linked} / ${master.length} matches.`);
    
    await client.close();
}

function findStrictMatch(entry, pool) {
    const raw = entry.result_name_raw.toLowerCase();
    const clean = normalize(entry.result_name_raw);
    
    // Infer State from raw name
    const stateInName = inferState(raw);
    if (!stateInName) return null;

    for (const inst of pool) {
        if (inst.canonicalState !== stateInName) continue;

        const nInst = normalize(inst.institution_name || inst.name);
        // Exact name match within same state
        if (clean === nInst) return inst;
    }
    return null;
}

function inferState(s) {
    const states = ["andhra", "arunachal", "assam", "bihar", "chhattisgarh", "goa", "gujarat", "haryana", "himachal", "jharkhand", "karnataka", "kerala", "madhya", "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim", "tamil", "telangana", "tripura", "uttar", "uttarakhand", "west bengal", "delhi", "puducherry"];
    for (const st of states) {
        if (s.includes(st)) return st;
    }
    return null;
}

function normalize(s) {
    return String(s || '')
        .split(',')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

main().catch(console.error);
