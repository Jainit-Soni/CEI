/**
 * backend/tools/dry_run_core_prefix_cleanup.js
 * ============================================
 * Dry-run identity migration tool.
 * Does NOT write to MongoDB.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// CONFIG
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'cei_v2';
const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'identity_hygiene');

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
    console.log("🔍 Starting Identity Cleanup Dry-Run...");
    
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    const matrix = [];
    const snapshots = [];
    const stats = {
        total_targets: Object.keys(REWRITE_MAP).length,
        source_found: 0,
        target_collision_risk: 0,
        affected_docs: 0,
        collection_stats: {}
    };

    COLLECTIONS.forEach(c => stats.collection_stats[c] = 0);

    for (const [source, target] of Object.entries(REWRITE_MAP)) {
        console.log(`Checking [${source}] -> [${target}]`);
        
        const itemReport = {
            source,
            target,
            status: 'PENDING',
            findings: [],
            affected_counts: {}
        };

        // 1. Check Source Existence in Catalog
        const sourceDoc = await db.collection('institutions').findOne({ $or: [{ id: source }, { institution_id: source }] });
        if (!sourceDoc) {
            itemReport.status = 'SOURCE_MISSING';
            itemReport.findings.push("Source ID not found in institutions catalog.");
        } else {
            stats.source_found++;
        }

        // 2. Check Target Collision
        const collisionDoc = await db.collection('institutions').findOne({ $or: [{ id: target }, { institution_id: target }] });
        if (collisionDoc) {
            stats.target_collision_risk++;
            itemReport.status = 'COLLISION_RISK';
            itemReport.findings.push(`Target ID already exists in institutions catalog (Doc: ${collisionDoc._id}).`);
        }

        // 3. Document Counts
        for (const colName of COLLECTIONS) {
            const count = await db.collection(colName).countDocuments({ 
                $or: [{ id: source }, { institution_id: source }, { stableKey: source }] 
            });
            itemReport.affected_counts[colName] = count;
            stats.collection_stats[colName] += count;
            stats.affected_docs += count;
        }

        if (itemReport.status === 'PENDING') itemReport.status = 'READY';
        
        matrix.push(itemReport);
        snapshots.push(itemReport);
    }

    // Write Reports
    writeCsv(path.join(REPORTS_DIR, 'core_prefix_cleanup_dry_run.csv'), matrix);
    fs.writeFileSync(path.join(REPORTS_DIR, 'core_prefix_cleanup_dry_run.ndjson'), snapshots.map(s => JSON.stringify(s)).join('\n'));
    generateMarkdownReport(stats, matrix);

    await client.close();
    console.log("✅ Dry-Run Complete. No data was modified.");
}

function writeCsv(filePath, data) {
    const headers = ['source', 'target', 'status', 'institutions', 'seat_matrix', 'engineering_cutoffs', 'colleges'];
    const rows = data.map(d => [
        d.source, d.target, d.status,
        d.affected_counts['institutions'] || 0,
        d.affected_counts['seat_matrix'] || 0,
        d.affected_counts['engineering_cutoffs'] || 0,
        d.affected_counts['colleges'] || 0
    ].join(','));
    fs.writeFileSync(filePath, [headers.join(','), ...rows].join('\n'));
}

function generateMarkdownReport(stats, matrix) {
    const md = `
# Identity Cleanup Dry-Run Report

**Date**: ${new Date().toISOString().split('T')[0]}
**Verdict**: ${stats.target_collision_risk > 0 ? '⚠️ COLLISION_RISK_DETECTED' : '✅ DRY_RUN_SUCCESS'}

## 1. Summary
- **Targets Evaluated**: ${stats.total_targets}
- **Sources Found**: ${stats.source_found}
- **Collision Risks**: ${stats.target_collision_risk}
- **Total Affected Documents**: ${stats.affected_docs}

## 2. Collection Impact
${Object.entries(stats.collection_stats).map(([col, count]) => `- **${col}**: ${count} documents`).join('\n')}

## 3. Detail Matrix
| Source | Target | Status | Inst | Seats | Cutoffs |
|--------|--------|--------|------|-------|---------|
${matrix.map(m => `| ${m.source} | ${m.target} | ${m.status} | ${m.affected_counts['institutions']} | ${m.affected_counts['seat_matrix']} | ${m.affected_counts['engineering_cutoffs']} |`).join('\n')}

## 4. Rollback Snapshot Plan
Before any actual migration, a mandatory snapshot command must be run:
\`\`\`bash
# Proposed snapshot commands
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
