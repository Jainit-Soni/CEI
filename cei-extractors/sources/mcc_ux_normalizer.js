#!/usr/bin/env node

/**
 * MCC Medical UX Normalizer (v2)
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    const reg = await fs.readJson('e:/CMAT-PROBLEM/backend/data/truth/medical_identity_registry.json');
    const linkedIds = Array.from(new Set(reg.filter(r => r.linkStatus === 'LINKED').map(r => r.targetId)));

    console.log(`Normalizing and promoting ${linkedIds.length} linked medical nodes...`);

    let fixedCount = 0;
    for (const id of linkedIds) {
        const node = await db.collection('institutions').findOne({ institution_id: id });
        if (node) {
            const originalName = node.canonical_name || node.institution_name;
            let normalized = normalizeName(originalName);

            await db.collection('institutions').updateOne(
                { _id: node._id },
                { $set: { 
                    institution_name: normalized,
                    canonical_name: originalName,
                    isVisible: true,
                    status: node.status || 'LINKED_MEDICAL_TRUTH',
                    ux_standard: '109D'
                }}
            );
            fixedCount++;
        }
    }

    console.log(`Successfully normalized and enabled ${fixedCount} nodes.`);
    await client.close();
}

function normalizeName(s) {
    if (!s) return s;
    return s
        .replace(/\bGOVT\.?\b/gi, 'Government')
        .replace(/\bCOLL\.?\b/gi, 'College')
        .replace(/\bINST\.?\b/gi, 'Institute')
        .replace(/\bMED\.?\b/gi, 'Medical')
        .replace(/\bD\.C\.\b/gi, 'Dental College')
        .replace(/&/g, 'and')
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(word => {
            if (word.length <= 3 && !['AND', 'FOR', 'THE'].includes(word.toUpperCase())) return word.toUpperCase();
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ')
        .replace(/, ,/g, ',')
        .trim();
}

main().catch(console.error);
