/**
 * backend/tools/audit_identity_hygiene.js
 * ========================================
 * Identity Hygiene Audit for CEI Public Cohort (Refined).
 * 
 * Classifies identity issues: CORE-CORE prefixes, aliases, stale IDs,
 * and mismatches across Institutions, Seat Matrix, and Engineering Cutoffs.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const resolver = require('../lib/collegeIdentityResolver');

// CONFIG
const SNAPSHOT_PATH = path.join(__dirname, '..', 'reports', 'frontend_visible_data_inventory', 'raw_audit_snapshot.ndjson');
const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'identity_hygiene');
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'cei_v2';

async function runAudit() {
    console.log("🚀 Starting CEI Identity Hygiene Audit (Refinement Pass) for 197-institution public cohort...");

    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

    // 1. Load Cohort
    if (!fs.existsSync(SNAPSHOT_PATH)) {
        console.error("❌ Snapshot file missing. Run visible_data_inventory first.");
        return;
    }
    const cohortLines = fs.readFileSync(SNAPSHOT_PATH, 'utf8').split('\n').filter(Boolean);
    const publicCohort = cohortLines.map(line => JSON.parse(line));
    console.log(`Loaded ${publicCohort.length} institutions from public cohort.`);

    // 2. Connect to DB
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const institutionsCol = db.collection('institutions');
    const seatsCol = db.collection('seat_matrix');
    const cutoffsCol = db.collection('engineering_cutoffs');

    const matrix = [];
    const rewriteReadyCases = [];
    const manualRequiredCases = [];
    const mismatchCases = [];
    const rawSnapshots = [];

    const stats = {
        total: publicCohort.length,
        safe: 0,
        review: 0,
        blocker: 0,
        core_core_prefix: 0,
        aicte_ids: 0,
        deterministic_rewrite_ready: 0,
        manual_canonical_target_required: 0
    };

    for (const college of publicCohort) {
        const frontendId = college.id;
        const normalizedName = college.name;

        if (frontendId.startsWith("CORE-AICTE-")) stats.aicte_ids++;

        // Fetch Catalog Doc
        const catalogDoc = await institutionsCol.findOne({ $or: [{ id: frontendId }, { institution_id: frontendId }] });
        const catalogId = catalogDoc ? (catalogDoc.id || catalogDoc.institution_id) : "MISSING";
        
        // Resolver Output
        const resolverId = resolver.resolveCanonicalId(frontendId);
        
        // Truth Checks
        const seatMatrixDocs = await seatsCol.find({ institution_id: { $in: [frontendId, resolverId, normalizedName] } }).limit(1).toArray();
        const seatMatrixId = seatMatrixDocs.length > 0 ? seatMatrixDocs[0].institution_id : "MISSING";
        const cutoffsDocs = await cutoffsCol.find({ institution_id: { $in: [frontendId, resolverId, normalizedName] } }).limit(1).toArray();
        const cutoffsId = cutoffsDocs.length > 0 ? cutoffsDocs[0].institution_id : "MISSING";

        const auditItem = {
            frontend_route_id: frontendId,
            catalog_id: catalogId,
            canonical_core_id: resolverId,
            normalized_name: normalizedName,
            seat_matrix_id: seatMatrixId,
            engineering_cutoffs_id: cutoffsId,
            resolver_output_id: resolverId,
            mismatch_type: "NONE",
            risk_level: "SAFE",
            recommended_fix: "None"
        };

        // BUCKETING & CLASSIFICATION
        const isCoreCore = frontendId.startsWith("CORE-CORE-");
        if (isCoreCore) {
            stats.core_core_prefix++;
            
            const isDeterministic = resolverId.startsWith("CORE-") && !resolverId.startsWith("CORE-CORE-") && resolverId !== frontendId;
            
            if (isDeterministic) {
                stats.deterministic_rewrite_ready++;
                auditItem.risk_level = "REVIEW";
                auditItem.mismatch_type = "DETERMINISTIC_REWRITE_READY";
                auditItem.recommended_fix = `Rewrite institution_id to ${resolverId}`;
                rewriteReadyCases.push({ id: frontendId, target: resolverId });
            } else {
                stats.manual_canonical_target_required++;
                auditItem.risk_level = (frontendId === "CORE-CORE-IIIT-PRADESH") ? "REVIEW_HIGH" : "REVIEW";
                auditItem.mismatch_type = "MANUAL_CANONICAL_TARGET_REQUIRED";
                auditItem.recommended_fix = "Manual canonical target required before migration";
                manualRequiredCases.push({ id: frontendId, resolver_output: resolverId });
            }
        }

        // Cross-linking mismatches
        const truthIds = [seatMatrixId, cutoffsId].filter(id => id !== "MISSING");
        const resolvedTruthIds = truthIds.map(id => resolver.resolveCanonicalId(id));
        const allIdsAlign = resolvedTruthIds.every(id => id === frontendId || id === resolverId);

        if (catalogId === "MISSING") {
            auditItem.risk_level = "BLOCKER";
            auditItem.mismatch_type = "CATALOG_ABSENCE";
            auditItem.recommended_fix = "Register institution in main colleges catalog";
        } else if (catalogId !== frontendId) {
            if (resolver.resolveCanonicalId(catalogId) === resolver.resolveCanonicalId(frontendId)) {
                auditItem.risk_level = "REVIEW";
                auditItem.mismatch_type = "CATALOG_ID_MISMATCH";
            } else {
                auditItem.risk_level = "BLOCKER";
                auditItem.mismatch_type = "CATALOG_ID_DIVERGENCE";
            }
        }

        if (truthIds.length > 0 && !allIdsAlign) {
            auditItem.risk_level = "BLOCKER";
            auditItem.mismatch_type = "TRUTH_LINKAGE_MISMATCH";
            mismatchCases.push(auditItem);
        }

        // Stats Increment
        if (auditItem.risk_level === "SAFE") stats.safe++;
        else if (auditItem.risk_level === "BLOCKER") stats.blocker++;
        else stats.review++;

        matrix.push(auditItem);
        rawSnapshots.push(auditItem);
    }

    // Write Reports
    writeCsv(path.join(REPORTS_DIR, 'public_cohort_identity_matrix.csv'), matrix);
    writeCsv(path.join(REPORTS_DIR, 'core_core_prefix_cases.csv'), [...rewriteReadyCases, ...manualRequiredCases]);
    writeCsv(path.join(REPORTS_DIR, 'id_mismatch_cases.csv'), mismatchCases);
    fs.writeFileSync(path.join(REPORTS_DIR, 'identity_hygiene_raw_snapshot.ndjson'), rawSnapshots.map(r => JSON.stringify(r)).join('\n'));

    generateMarkdownReport(stats, rewriteReadyCases, manualRequiredCases, mismatchCases);
    generateCleanupPlan(stats, rewriteReadyCases, manualRequiredCases, matrix);

    await client.close();
    console.log("✅ Identity Hygiene Audit Complete.");
}

function writeCsv(filePath, data) {
    if (data.length === 0) {
        fs.writeFileSync(filePath, "No cases found\n");
        return;
    }
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','));
    fs.writeFileSync(filePath, [headers.join(','), ...rows].join('\n'));
}

function generateMarkdownReport(stats, rewriteReady, manualRequired, mismatchCases) {
    const isPureCohort = stats.aicte_ids === 0;
    const cohortStatus = isPureCohort ? "Pure Core Engineering IIT/NIT/IIIT cohort" : `Public engineering cohort including AICTE/catalog records (${stats.aicte_ids} AICTE IDs detected)`;
    
    const md = `
# CEI Identity Hygiene Audit Report

**Date**: ${new Date().toISOString().split('T')[0]}
**Cohort Size**: ${stats.total}
**Cohort Definition**: ${cohortStatus}
**Verdict**: ${stats.blocker > 0 ? '❌ IDENTITY_HYGIENE_FAILED' : '✅ IDENTITY_HYGIENE_STABLE'}

${!isPureCohort ? '> [!IMPORTANT]\n> **PUBLIC_COHORT_DEFINITION_REVIEW**: The cohort contains non-elite AICTE identifiers. Verify if this matches release intent.' : ''}

## 1. Summary Stats
- **Total Audited**: ${stats.total}
- **SAFE**: ${stats.safe}
- **REVIEW**: ${stats.review}
- **BLOCKER**: ${stats.blocker}

> [!NOTE]
> **Summary Clarification**: ${stats.safe} records have no detected identity conflict under current resolver rules. Missing truth records are not counted as identity mismatches.

## 2. Identified Risks
- **CORE-CORE Prefix Cases**: ${stats.core_core_prefix}
  - Deterministic Rewrite-Ready: ${stats.deterministic_rewrite_ready}
  - Manual Canonical Target Required: ${stats.manual_canonical_target_required}
- **Identity Mismatches**: ${mismatchCases.length}

## 3. Top 10 Risky Mismatches
${mismatchCases.slice(0, 10).map(m => `- **${m.frontend_route_id}**: ${m.mismatch_type} (Catalog: ${m.catalog_id}, Resolver: ${m.resolver_output_id})`).join('\n') || "None found"}

## 4. Double Prefix Analysis (CORE-CORE)
Found ${stats.core_core_prefix} instances of double-prefixed IDs. 
- **PRADESH Case**: CORE-CORE-IIIT-PRADESH remains unresolved (Manual Target Required).

## 5. Audit Integrity
- Verified across Catalog (Institutions), Seat Matrix, and Engineering Cutoffs collections.
- Regression guard references preserved.
`;

    fs.writeFileSync(path.join(REPORTS_DIR, 'IDENTITY_HYGIENE_AUDIT.md'), md);
}

function generateCleanupPlan(stats, rewriteReady, manualRequired, matrix) {
    const safeRecords = matrix.filter(m => m.risk_level === 'SAFE');
    const noMutationIds = [...safeRecords.map(m => m.frontend_route_id), ...manualRequired.map(m => m.id)];

    const md = `
# CEI Identity Cleanup Plan

**Goal**: Sequentially migrate messy or double-prefixed IDs to their canonical forms.

## 1. Audit Summary
- **Total Cases Audited**: ${stats.total}
- **Safe Records (No Mutation)**: ${safeRecords.length}
- **Deterministic Rewrite-Ready**: ${stats.deterministic_rewrite_ready}
- **Manual Canonical Target Required**: ${stats.manual_canonical_target_required}
- **Blocker Count**: ${stats.blocker}

## 2. Migration Targets (Deterministic)
The following ${rewriteReady.length} IDs are ready for automated migration:
${rewriteReady.map(r => `- \`${r.id}\` -> \`${r.target}\``).join('\n')}

## 3. No-Mutation List
The following IDs will NOT be modified:
- All Safe Records (${safeRecords.length} items)
- Unresolved Cases:
${manualRequired.map(r => `  - \`${r.id}\` (Resolver output: \`${r.resolver_output}\`)`).join('\n')}

## 4. Execution Sequence (Dry-Run Only)
1. **Catalog Update**: Rename \`institution_id\` and \`id\` in \`institutions\` collection.
2. **Truth Alignment**: Update \`institution_id\` in \`seat_matrix\` and \`engineering_cutoffs\`.
3. **Cache Invalidation**: Flush Redis page cache and global dataStore.
4. **Verification**: Rerun \`verify_limited_public_truth_surface.js\`.

## 5. Rollback Strategy
- Snapshot of \`institutions\`, \`seat_matrix\`, and \`engineering_cutoffs\` must be taken before migration.
- Reversion script: \`node backend/tools/rollback_identity_migration.js --snapshot <id>\`.

## 6. Required Verification
- \`npm run verify:release-surface\`
- \`node backend/scripts/verify_limited_public_truth_surface.js\`
`;

    fs.writeFileSync(path.join(REPORTS_DIR, 'IDENTITY_CLEANUP_PLAN.md'), md);
}

runAudit();
