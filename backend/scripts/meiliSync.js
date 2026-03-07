/**
 * scripts/meiliSync.js — Meilisearch Index Sync
 * ===============================================
 * Syncs the CEI college dataset into a Meilisearch index for
 * typo-tolerant, sub-5ms search.
 *
 * USAGE:
 *   node scripts/meiliSync.js               # Full sync
 *   node scripts/meiliSync.js --dry-run     # Count docs only, no write
 *   node scripts/meiliSync.js --force       # Re-index even if index exists
 *
 * ENV REQUIRED:
 *   MEILISEARCH_URL=http://localhost:7700
 *   MEILISEARCH_KEY=your-master-key         (optional)
 *   MONGODB_URI=your-connection-string
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const mongoose = require('mongoose');
const { MEILI_INDEX } = require('../services/searchService');
const { getMeiliClient } = require('../services/searchService');
const College = require('../models/CollegeSchema');

const isDryRun = process.argv.includes('--dry-run');
const isForce = process.argv.includes('--force');
const BATCH = 2000; // Meili batch size

// Fields to index — keep payload small
const INDEXED_FIELDS = [
    'id', 'name', 'shortName', 'location', 'state',
    'rankingTier', 'competitivenessBand', 'ceiScore',
    'placements.highestPackageNumeric'
];

async function main() {
    console.log('\n🔍 CEI → Meilisearch Index Sync\n');

    if (!process.env.MEILISEARCH_URL) {
        console.error('❌  MEILISEARCH_URL not set. Exiting.');
        process.exit(1);
    }

    // Connect MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅  MongoDB connected');

    // Get Meilisearch client
    const client = await getMeiliClient();
    if (!client) {
        console.error('❌  Cannot connect to Meilisearch at', process.env.MEILISEARCH_URL);
        process.exit(1);
    }
    console.log('✅  Meilisearch connected\n');

    const index = client.index(MEILI_INDEX);

    // ── Configure index settings ───────────────────────────────────────────────
    if (isForce || !(await index.getRawInfo().catch(() => null))) {
        console.log('⚙️   Configuring index settings...');
        await index.updateSettings({
            searchableAttributes: ['name', 'shortName', 'location', 'state'],
            filterableAttributes: ['state', 'rankingTier', 'competitivenessBand'],
            sortableAttributes: ['ceiScore', 'placements.highestPackageNumeric'],
            rankingRules: [
                'words', 'typo', 'proximity', 'attribute',
                'sort', 'exactness',
                'ceiScore:desc',   // Boost higher-scored colleges
            ],
            typoTolerance: {
                enabled: true,
                minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 }
            },
        });
        console.log('✅  Index configured\n');
    }

    // ── Count colleges ────────────────────────────────────────────────────────
    const total = await College.countDocuments();
    console.log(`📊  Total colleges to sync: ${total}`);

    if (isDryRun) {
        console.log('ℹ️   Dry run — no documents written.');
        await mongoose.disconnect();
        process.exit(0);
    }

    // ── Batch sync ────────────────────────────────────────────────────────────
    const pages = Math.ceil(total / BATCH);
    let synced = 0;

    for (let page = 0; page < pages; page++) {
        const docs = await College.find({})
            .skip(page * BATCH)
            .limit(BATCH)
            .select(INDEXED_FIELDS.join(' '))
            .lean();

        // Meilisearch requires a unique `id` field at root level
        const formatted = docs.map(doc => ({
            id: doc.id,
            name: doc.name,
            shortName: doc.shortName || null,
            location: doc.location || null,
            state: doc.state || null,
            rankingTier: doc.rankingTier || null,
            competitivenessBand: doc.competitivenessBand || null,
            ceiScore: doc.ceiScore || 0,
            highestPackage: doc.placements?.highestPackageNumeric || 0,
        }));

        const task = await index.addDocuments(formatted);
        synced += formatted.length;

        console.log(`  Batch ${page + 1}/${pages}: ${synced}/${total} synced (taskId: ${task.taskUid})`);
    }

    console.log(`\n✅  Sync complete. ${synced} colleges indexed in Meilisearch.`);
    console.log(`    Index: ${MEILI_INDEX}`);
    console.log(`    URL:   ${process.env.MEILISEARCH_URL}\n`);

    await mongoose.disconnect();
    process.exit(0);
}

main().catch(err => {
    console.error('❌  Sync failed:', err.message);
    process.exit(2);
});
