/**
 * backend/tools/dry_run_core_prefix_cleanup.js
 * ============================================
 * Dry-run identity migration tool (Hardened).
 * Does NOT write to MongoDB.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// CONFIG
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'cei_v2';
const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'identity_hygiene');

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
    'colleges',           // Potential legacy collection
    'institutions',        // Primary catalog
    'seat_matrix',        // Truth
    'engineering_cutoffs' // Truth
];

async function runDryRun() {
    console.log("🔍 Starting Hardened Identity Cleanup Dry-Run...");
    console.log(`Connecting to ${MONGO_URI}/${DB_NAME}`);
    
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);

        const matrix = [];
        const snapshots = [];
        const stats = {
            total_targets: Object.keys(REWRITE_MAP).length,
            source_found: 0,
            target_collision_risk: 0,
            affected_docs: 0,
            collection_stats: {},
            excluded_count: 0
        };

        COLLECTIONS.forEach(c => stats.collection_stats[c] = 0);

        // Security check: ensure no excluded IDs are in the rewrite map
        for (const excluded of EXCLUDED_IDS) {
            if (REWRITE_MAP[excluded]) {
                console.error(`❌ SECURITY VIOLATION: Excluded ID ${excluded} found in REWRITE_MAP!`);
                process.exit(1);
            }
        }

        for (const [source, target] of Object.entries(REWRITE_MAP)) {
            console.log(`Checking [${source}] -> [${target}]`);
            
            const itemReport = {
                source,
                target,
                status: 'PENDING',
                findings: [],
                affected_counts: {},
                collisions: []
            };

            // 1. Check Source Existence in Catalog
            const sourceDoc = await db.collection('institutions').findOne({ $or: [{ id: source }, { institution_id: source }] });
            if (!sourceDoc) {
                itemReport.status = 'SOURCE_MISSING';
                itemReport.findings.push("Source ID not found in institutions catalog.");
            } else {
                stats.source_found++;
            }

            // 2. Check Collisions (Same-collection only)
            for (const colName of COLLECTIONS) {
                const count = await db.collection(colName).countDocuments({ 
                    $or: [{ id: source }, { institution_id: source }, { stableKey: source }] 
                });
                itemReport.affected_counts[colName] = count;
                stats.collection_stats[colName] += count;
                stats.affected_docs += count;

                if (count > 0) {
                    // Check if target already exists in THIS collection
                    const collision = await db.collection(colName).findOne({ 
                        $or: [{ id: target }, { institution_id: target }, { stableKey: target }] 
                    });
                    if (collision) {
                        itemReport.collisions.push({ collection: colName, id: collision._id });
                        itemReport.findings.push(`Same-collection collision in ${colName} (Doc: ${collision._id}).`);
                        itemReport.status = 'COLLISION_RISK';
                    }
                }
            }

            if (itemReport.collisions.length > 0) {
                stats.target_collision_risk++;
            }

            if (itemReport.status === 'PENDING') itemReport.status = 'READY';
            
            matrix.push(itemReport);
            snapshots.push(itemReport);
        }

        // Write Reports
        writeCsv(path.join(REPORTS_DIR, 'core_prefix_cleanup_dry_run.csv'), matrix);
        fs.writeFileSync(path.join(REPORTS_DIR, 'core_prefix_cleanup_dry_run.ndjson'), snapshots.map(s => JSON.stringify(s)).join('\n'));
        generateMarkdownReport(stats, matrix);

        console.log(`✅ Dry-Run Complete. Verdict: ${stats.target_collision_risk > 0 ? 'DRY_RUN_BLOCKED' : 'DRY_RUN_READY_FOR_MIGRATION_SCRIPT'}`);
    } finally {
        await client.close();
    }
}

function writeCsv(filePath, data) {
    const headers = ['source', 'target', 'status', 'institutions', 'seat_matrix', 'engineering_cutoffs', 'colleges', 'collisions'];
    const rows = data.map(d => [
        d.source, d.target, d.status,
        d.affected_counts['institutions'] || 0,
        d.affected_counts['seat_matrix'] || 0,
        d.affected_counts['engineering_cutoffs'] || 0,
        d.affected_counts['colleges'] || 0,
        `"${(d.collisions || []).map(c => `${c.collection}:${c.id}`).join('; ')}"`
    ].join(','));
    fs.writeFileSync(filePath, [headers.join(','), ...rows].join('\n'));
}

function generateMarkdownReport(stats, matrix) {
    const verdict = stats.target_collision_risk > 0 ? 'DRY_RUN_BLOCKED' : 'DRY_RUN_READY_FOR_MIGRATION_SCRIPT';
    const md = `
# Identity Cleanup Dry-Run Report (Hardened)

**Date**: ${new Date().toISOString().split('T')[0]}
**Verdict**: ${verdict === 'DRY_RUN_BLOCKED' ? '⚠️ ' + verdict : '✅ ' + verdict}

## 1. Summary
- **Targets Evaluated**: ${stats.total_targets}
- **Sources Found**: ${stats.source_found}
- **Collision Risks**: ${stats.target_collision_risk}
- **Total Affected Documents**: ${stats.affected_docs}
- **Explicitly Excluded**: ${EXCLUDED_IDS.join(', ')}

## 2. Collection Impact
${Object.entries(stats.collection_stats).map(([col, count]) => `- **${col}**: ${count} documents`).join('\n')}

## 3. Detail Matrix
| Source | Target | Status | Inst | Seats | Cutoffs | Collisions |
|--------|--------|--------|------|-------|---------|------------|
${matrix.map(m => `| ${m.source} | ${m.target} | ${m.status} | ${m.affected_counts['institutions']} | ${m.affected_counts['seat_matrix']} | ${m.affected_counts['engineering_cutoffs']} | ${m.collisions.length} |`).join('\n')}

## 4. Rollback Snapshot Plan
Before any actual migration, a mandatory snapshot command must be run:
\`\`\`bash
# Mandatory snapshot commands
mongodump --db ${DB_NAME} --collection institutions --out snapshots/pre_migration/
mongodump --db ${DB_NAME} --collection seat_matrix --out snapshots/pre_migration/
mongodump --db ${DB_NAME} --collection engineering_cutoffs --out snapshots/pre_migration/
\`\`\`

## 5. Verification
> [!IMPORTANT]
> This was a **dry-run only**. No documents were modified in MongoDB.
`;
    fs.writeFileSync(path.join(REPORTS_DIR, 'core_prefix_cleanup_dry_run.md'), md);
}

runDryRun();
