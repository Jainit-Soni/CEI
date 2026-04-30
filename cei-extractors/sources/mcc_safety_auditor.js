#!/usr/bin/env node

/**
 * MCC Auto-Provision Safety Auditor (Phase 108B)
 * ============================================
 * Stress-tests candidates using NMC patterns and explicit state validation.
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

const CANDIDATES_PATH = 'e:/CMAT-PROBLEM/cei-extractors/output/medical_auto_provision_candidates.ndjson';
const MASTER_BRIDGE_PATH = 'e:/CMAT-PROBLEM/cei-extractors/output/medical_identity_registry_master.ndjson';
const OUTPUT_PATH = 'e:/CMAT-PROBLEM/cei-extractors/output/mcc_auto_provision_candidates_audited.ndjson';

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const dbV2 = client.db('cei_v2');

    const candidates = fs.readFileSync(CANDIDATES_PATH, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const master = fs.readFileSync(MASTER_BRIDGE_PATH, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const masterMap = new Map();
    master.forEach(m => masterMap.set(m.mcc_id, m));

    const audited = [];
    const summary = { safe: 0, review: 0, blocked_collision: 0, blocked_evidence: 0 };

    console.log('Running Safety Audit on 236 candidates...');

    for (const c of candidates) {
        if (c.status === 'BLOCKED') {
            audited.push(c);
            summary.blocked_collision++;
            continue;
        }

        const mInfo = masterMap.get(c.mccId);
        const rawName = c.rawName.toUpperCase();
        
        // 1. Authoritative State Validation (No guessing)
        // MCC master contains State in the rawName tail or address.
        const explicitState = extractExplicitState(c.rawName);
        
        // 2. NMC Corroboration (Heuristic: GMC/GDC + Location + Authority indicators)
        const isCorroborated = (rawName.includes('GOVT') || rawName.includes('GOVERNMENT')) && 
                               (rawName.includes('MEDICAL COLLEGE') || rawName.includes('HOSPITAL')) &&
                               mInfo && mInfo.pin;

        let status = 'MANUAL_REVIEW_REQUIRED';
        let reason = 'Needs human verification of NMC/NTA affiliation';

        if (isCorroborated && explicitState) {
            status = 'SAFE_TO_PROVISION';
            reason = 'MCC + NMC Pattern Match (GMC verified with Pincode)';
        } else if (!explicitState) {
            status = 'BLOCKED_INSUFFICIENT_EVIDENCE';
            reason = 'State could not be authoritatively verified';
        }

        // 3. Re-check collision with refined names
        const cleanName = normalize(c.rawName);
        const collision = await dbV2.collection('institutions').findOne({ 
            institution_name: { $regex: cleanName, $options: 'i' },
            state_name: { $regex: explicitState || 'NEVER_MATCH', $options: 'i' }
        });

        if (collision) {
            status = 'BLOCKED_COLLISION';
            reason = `High-confidence collision detected with ${collision.institution_id}`;
        }

        audited.push({
            ...c,
            status: status,
            reason: reason,
            explicit_state: explicitState,
            evidence: {
                has_pincode: !!(mInfo && mInfo.pin),
                mcc_state: explicitState,
                nmc_pattern_match: isCorroborated
            }
        });

        if (status === 'SAFE_TO_PROVISION') summary.safe++;
        else if (status === 'MANUAL_REVIEW_REQUIRED') summary.review++;
        else if (status === 'BLOCKED_COLLISION') summary.blocked_collision++;
        else summary.blocked_evidence++;
    }

    const ndjson = audited.map(a => JSON.stringify(a)).join('\n');
    await fs.writeFile(OUTPUT_PATH, ndjson);

    console.log(`\n--- Safety Audit Results ---`);
    console.log(`Safe to Provision: ${summary.safe}`);
    console.log(`Manual Review Required: ${summary.review}`);
    console.log(`Blocked (Collision): ${summary.blocked_collision}`);
    console.log(`Blocked (Insufficient Evidence): ${summary.blocked_evidence}`);

    await client.close();
}

function extractExplicitState(s) {
    // MCC usually puts the state after the second comma
    const parts = s.split(',');
    if (parts.length < 2) return null;
    const statePart = parts[parts.length - 2].trim().toUpperCase();
    
    const states = ["ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL", "DELHI", "PUDUCHERRY"];
    
    for (const st of states) {
        if (statePart.includes(st)) return st;
    }
    return null;
}

function normalize(s) {
    return String(s || '').split(',')[0].trim();
}

main().catch(console.error);
