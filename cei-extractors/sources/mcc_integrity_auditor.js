#!/usr/bin/env node

/**
 * MCC Integrity Auditor (Phase 109E)
 * ==================================
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    const nodes = await db.collection('institutions').find({ isVisible: true }).toArray();
    
    const promoted = nodes.filter(n => n.status === 'PROMOTED_MEDICAL_TRUTH');
    const recovered = nodes.filter(n => n.source_record_type === 'mcc_catalog_recovery');
    const core = nodes.filter(n => n.isCore === true && !promoted.includes(n));

    console.log('\n--- Phase 1: Source Classification ---');
    console.log(`Promoted Batch 1/2: ${promoted.length}`);
    console.log(`Recovered Batch (109D): ${recovered.length}`);
    console.log(`Core/Linked Batch: ${core.length}`);
    console.log(`Total Public Medical: ${nodes.length}`);

    console.log('\n--- Phase 2: Hardening Gap Audit (Recovered Batch) ---');
    const auditResults = [];

    for (const node of recovered) {
        const isGMC = node.institution_name.toUpperCase().includes('GOVERNMENT') || node.institution_name.toUpperCase().includes('GOVT');
        const hasCity = node.institution_name.includes(',');
        const isAmbiguous = node.institution_name.includes('Reported') || node.institution_name.includes('Variant');

        const status = (isGMC && hasCity && !isAmbiguous) ? 'FULLY_HARDENED' : 'PARTIALLY_HARDENED';
        const risk = !isGMC ? 'HIGH (Non-GMC in Public Batch)' : (isAmbiguous ? 'MEDIUM (Naming Drift)' : 'LOW');

        console.log(`[${status}] ${node.institution_name} - Risk: ${risk}`);
        auditResults.push({ id: node.institution_id, name: node.institution_name, status, risk });
    }

    await fs.writeJson('e:/CMAT-PROBLEM/cei-extractors/output/mcc_integrity_audit.json', auditResults, { spaces: 2 });
    await client.close();
}

main().catch(console.error);
