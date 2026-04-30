#!/usr/bin/env node

/**
 * MCC Selective Promotion Auditor (Phase 109)
 * ==========================================
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    // 1. Get Top 10 provisioned nodes by seat volume
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
    })).sort((a,b) => b.seats - a.seats).slice(0, 10);

    console.log('\n--- Phase 2: Top 10 Selection ---');
    console.table(candidates);

    // 2. Perform Audit
    console.log('\n--- Phase 3: Manual-Grade Audit ---');
    for (const c of candidates) {
        // Verification logic:
        // - Ensure it's a GMC
        // - Ensure state is explicit (already done in 108B)
        // - Check for Hospital vs College ambiguity
        const isGMC = c.name.toUpperCase().includes('GOVT') || c.name.toUpperCase().includes('GOVERNMENT');
        const isHospitalConfusion = c.name.toUpperCase().includes('HOSPITAL') && !c.name.toUpperCase().includes('MEDICAL COLLEGE');
        
        const status = (isGMC && !isHospitalConfusion) ? 'PASS' : 'FAIL';
        const reason = status === 'PASS' ? 'Deterministic GMC Name + Verified State' : 'Ambiguous Identity or Hospital node';
        
        console.log(`[${status}] ${c.name} (${c.state}) - ${reason}`);
        c.auditStatus = status;
    }

    await fs.writeJson('e:/CMAT-PROBLEM/cei-extractors/output/mcc_promotion_audit.json', candidates, { spaces: 2 });
    await client.close();
}

main().catch(console.error);
