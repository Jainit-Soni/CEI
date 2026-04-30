#!/usr/bin/env node

/**
 * Linked Cohort Index Generator
 * =============================
 * Generates the definitive list of linked institutions and coverage metrics.
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

const REGISTRY_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_identity_registry.json';
const OUTPUT_PATH = 'e:/CMAT-PROBLEM/cei-extractors/output/medical_linked_cohort_index.md';

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    const registry = await fs.readJson(REGISTRY_PATH);
    const linked = registry.filter(r => r.linkStatus === 'LINKED');

    // Total counts in DB for context
    const totalMedicalSeats = await db.collection('medical_seat_matrix').countDocuments();
    const totalMedicalCutoffs = await db.collection('medical_cutoffs').countDocuments();

    // Coverage per linked institute
    const cohort = [];
    let totalSeatsLinked = 0;
    let totalCutoffsLinked = 0;

    for (const entry of linked) {
        const seatCount = await db.collection('medical_seat_matrix').countDocuments({ institution_id: entry.targetId });
        const cutoffCount = await db.collection('medical_cutoffs').countDocuments({ institution_id: entry.targetId });
        
        totalSeatsLinked += seatCount;
        totalCutoffsLinked += cutoffCount;

        cohort.push({
            mccId: entry.mccId,
            targetId: entry.targetId,
            name: entry.targetName || entry.rawName,
            seats: seatCount,
            cutoffs: cutoffCount
        });
    }

    const report = `
# MCC Linked Cohort Index
Generated: ${new Date().toISOString()}

## Summary Metrics
- **Total Linked Institutions**: ${linked.length}
- **Seat Coverage**: ${totalSeatsLinked} / ${totalMedicalSeats} (${((totalSeatsLinked/totalMedicalSeats)*100).toFixed(1)}%)
- **Cutoff Coverage**: ${totalCutoffsLinked} / ${totalMedicalCutoffs} (${((totalCutoffsLinked/totalMedicalCutoffs)*100).toFixed(1)}%)
- **Manual Overrides**: ${registry.filter(r => r.linkReason === 'Manual Override').length}

## Cohort List (Top 50 by Coverage)
| MCC ID | Target ID | Institution Name | Seats | Cutoffs |
| :--- | :--- | :--- | :--- | :--- |
${cohort.sort((a,b) => b.seats - a.seats).slice(0, 50).map(c => `| ${c.mccId} | ${c.targetId} | ${c.name} | ${c.seats} | ${c.cutoffs} |`).join('\n')}

---
*Note: Only LINKED institutions are exposed to the API/Frontend.*
`;

    await fs.writeFile(OUTPUT_PATH, report);
    console.log(`Linked Cohort Index generated at: ${OUTPUT_PATH}`);
    await client.close();
}

main().catch(console.error);
