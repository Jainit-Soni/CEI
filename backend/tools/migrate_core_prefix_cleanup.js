/**
 * backend/tools/migrate_core_prefix_cleanup.js
 * ============================================
 * Identity migration tool for CORE-CORE cleanup.
 * 
 * Usage:
 * node backend/tools/migrate_core_prefix_cleanup.js --dry-run
 * node backend/tools/migrate_core_prefix_cleanup.js --apply --confirm-core-prefix-cleanup
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// CONFIG
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'cei_v2';
const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'identity_hygiene');

// ARGS
const isApply = process.argv.includes('--apply');
const isConfirmed = process.argv.includes('--confirm-core-prefix-cleanup');
const isDryRun = process.argv.includes('--dry-run') || !isApply;

// EXPLICIT EXCLUSIONS
const EXCLUDED_IDS = [
    'CORE-CORE-IIIT-PRADESH'
];

const REWRITE_MAP = {
    'CORE-CORE-IIIT-CHITTOOR': 'CORE-IIIT-CHITTOOR',
    'CORE-CORE-IIIT-GUWAHATI': 'CORE-IIIT-GUWAHATI',
    'CORE-CORE-IIIT-KARNATAKA': 'CORE-IIIT-KARNATAKA',
    'CORE-CORE-IIIT-MANIPUR': 'CORE-IIIT-MANIPUR',
    'CORE-CORE-IIIT-RAJASTHAN': 'CORE-IIIT-RAJASTHAN',
    'CORE-CORE-IIIT-TIRUCHIRAPPALLI': 'CORE-IIIT-TIRUCHIRAPPALLI'
};

const COLLECTIONS = [
    'colleges',
    'institutions',
    'seat_matrix',
    'engineering_cutoffs'
];

async function runMigration() {
    console.log(`🚀 Starting Identity Migration Tool... [Mode: ${isDryRun ? 'DRY-RUN' : 'APPLY'}]`);
    
    if (isApply && !isConfirmed) {
        console.error("❌ ERROR: --apply requires --confirm-core-prefix-cleanup");
        process.exit(1);
    }

    if (isApply) {
        console.warn("⚠️  WARNING: You are about to mutate production data.");
        console.warn("⚠️  Ensure you have run a full snapshot (mongodump) first.");
    }

    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);

        const auditTrail = [];
        const stats = {
            processed: 0,
            updated_docs: 0,
            skipped: 0,
            errors: 0
        };

        for (const [oldId, newId] of Object.entries(REWRITE_MAP)) {
            if (EXCLUDED_IDS.includes(oldId)) {
                console.log(`Skipping excluded ID: ${oldId}`);
                stats.skipped++;
                continue;
            }

            console.log(`Migrating ${oldId} -> ${newId}...`);
            const itemReport = { oldId, newId, collections: {} };

            for (const colName of COLLECTIONS) {
                const col = db.collection(colName);
                
                // Deterministic match only: id, institution_id, or stableKey
                const filter = {
                    $or: [
                        { id: oldId },
                        { institution_id: oldId },
                        { stableKey: oldId }
                    ]
                };

                const affectedCount = await col.countDocuments(filter);
                itemReport.collections[colName] = affectedCount;

                if (affectedCount > 0) {
                    if (isDryRun) {
                        console.log(`  [DRY-RUN] Would update ${affectedCount} docs in ${colName}`);
                    } else {
                        const result = await col.updateMany(filter, [
                            {
                                $set: {
                                    id: { $cond: [{ $eq: ["$id", oldId] }, newId, "$id"] },
                                    institution_id: { $cond: [{ $eq: ["$institution_id", oldId] }, newId, "$institution_id"] },
                                    stableKey: { $cond: [{ $eq: ["$stableKey", oldId] }, newId, "$stableKey"] }
                                }
                            }
                        ]);
                        console.log(`  [APPLY] Updated ${result.modifiedCount} docs in ${colName}`);
                        stats.updated_docs += result.modifiedCount;
                    }
                }
            }
            stats.processed++;
            auditTrail.push(itemReport);
        }

        // Generate Reports
        generateMarkdownPlan(stats, auditTrail);
        writeCsv(path.join(REPORTS_DIR, `core_prefix_cleanup_${isDryRun ? 'apply_preview' : 'migration_final'}.csv`), auditTrail);
        fs.writeFileSync(path.join(REPORTS_DIR, `core_prefix_cleanup_${isDryRun ? 'apply_preview' : 'migration_final'}.ndjson`), auditTrail.map(t => JSON.stringify(t)).join('\n'));

        console.log(`\n✅ Migration Task Complete.`);
        console.log(`Processed: ${stats.processed}, Updated Docs: ${stats.updated_docs}, Skipped: ${stats.skipped}`);
    } finally {
        await client.close();
    }
}

function generateMarkdownPlan(stats, auditTrail) {
    const md = `
# Identity Migration Plan: CORE-CORE Cleanup

**Date**: ${new Date().toISOString().split('T')[0]}
**Mode**: ${isDryRun ? 'DRY-RUN / PREVIEW' : 'APPLY'}
**Status**: ${isDryRun ? 'PENDING_APPROVAL' : 'EXECUTED'}

## 1. Migration Summary
- **Target Identities**: ${stats.processed}
- **Total Affected Documents**: ${stats.updated_docs || 'Pending Preview'}
- **Excluded Identities**: ${EXCLUDED_IDS.length} (${EXCLUDED_IDS.join(', ')})

## 2. Detailed Impact Matrix
| Old ID | New ID | Inst | Seats | Cutoffs | Colleges |
|--------|--------|------|-------|---------|----------|
${auditTrail.map(t => `| ${t.oldId} | ${t.newId} | ${t.collections['institutions'] || 0} | ${t.collections['seat_matrix'] || 0} | ${t.collections['engineering_cutoffs'] || 0} | ${t.collections['colleges'] || 0} |`).join('\n')}

## 3. Safety Measures
- **Deterministic Match**: Updates only apply to exact matches of \`id\`, \`institution_id\`, or \`stableKey\`.
- **No Fuzzy Matching**: No name-based or partial-string updates performed.
- **Rollback Path**: Snapshots must be restored from \`snapshots/pre_migration/\` if errors occur.

## 4. Post-Migration Verification
Run the following after applying:
1. \`npm run verify:release-surface\`
2. \`node backend/scripts/verify_limited_public_truth_surface.js\`
3. \`node backend/tools/audit_identity_hygiene.js --cohort public --limit ALL\`
`;
    fs.writeFileSync(path.join(REPORTS_DIR, 'core_prefix_cleanup_migration_plan.md'), md);
}

function writeCsv(filePath, data) {
    const headers = ['oldId', 'newId', 'institutions', 'seat_matrix', 'engineering_cutoffs', 'colleges'];
    const rows = data.map(t => [
        t.oldId, t.newId,
        t.collections['institutions'] || 0,
        t.collections['seat_matrix'] || 0,
        t.collections['engineering_cutoffs'] || 0,
        t.collections['colleges'] || 0
    ].join(','));
    fs.writeFileSync(filePath, [headers.join(','), ...rows].join('\n'));
}

runMigration();
