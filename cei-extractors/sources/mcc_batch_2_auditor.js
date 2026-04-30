#!/usr/bin/env node

/**
 * MCC Batch 2 Auditor (Next 20)
 * =============================
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    // 1. Get next 20 provisioned nodes by seat volume (that are still hidden)
    const nodes = await db.collection('institutions').find({ 
        source_record_type: 'mcc_auto_provisioned', 
        isVisible: false 
    }).toArray();

    const seats = await db.collection('medical_seat_matrix').aggregate([
        { $group: { _id: '$institution_id', total: { $sum: '$seat_count' } } }
    ]).toArray();

    const seatMap = {};
    seats.forEach(s => seatMap[s._id] = s.total);

    const candidates = nodes.map(n => ({
        institution_id: n.institution_id,
        mccId: n.mcc_id,
        name: n.institution_name,
        state: n.state_name,
        seats: seatMap[n.institution_id] || 0
    })).sort((a,b) => b.seats - a.seats).slice(0, 20);

    console.log('\n--- Phase 1: Next 20 Selection ---');
    console.table(candidates);

    const reg = await fs.readJson('e:/CMAT-PROBLEM/backend/data/truth/medical_identity_registry.json');
    const passBatch = [];

    console.log('\n--- Phase 2: Strict Audit ---');
    for (const c of candidates) {
        const r = reg.find(entry => entry.mccId === c.mccId);
        if (!r) continue;

        // Long-form name check
        const parts = r.rawName.split(',');
        const longName = (parts[0] + (parts[1] ? ', ' + parts[1] : '')).trim();

        const isGMC = longName.toUpperCase().includes('GOVT') || longName.toUpperCase().includes('GOVERNMENT');
        const isAmbiguous = longName.includes('Reported') || longName.includes('Seat Surrendered');

        if (isGMC && !isAmbiguous) {
            console.log(`[PASS] ${longName}`);
            passBatch.push({ ...c, longName });
        } else {
            console.log(`[REJECT] ${longName} (Reason: ${isAmbiguous ? 'Ambiguous Variant' : 'Non-GMC/Ambiguous'})`);
        }
    }

    await fs.writeJson('e:/CMAT-PROBLEM/cei-extractors/output/mcc_batch_2_audit.json', passBatch, { spaces: 2 });
    await client.close();
}

main().catch(console.error);
