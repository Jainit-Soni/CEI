/**
 * backend/scripts/pre_migration_identity_audit.js
 * ===============================================
 * Generates a pre-migration audit for identity enforcement recode.
 * Categorizes changes, identifies conflicts, and creates a rollback manifest.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const identityEnforcement = require('../lib/identityEnforcement');
require('dotenv').config({ path: 'backend/.env.local' });

const COLLECTIONS = ['engineering_cutoffs', 'seat_matrix'];
const MANIFEST_PATH = path.join(__dirname, '..', '..', 'reports', 'identity_migration_manifest.json');
const REPORT_PATH = path.join(__dirname, '..', '..', 'reports', 'identity_migration_audit.md');

async function runAudit() {
    try {
        console.log("--- 🕵️ Identity Enforcement Pre-Migration Audit ---");
        
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        const auditData = {
            mappings: {}, // old -> new -> count
            conflicts: {}, // newId -> { existing, incoming }
            samples: {}, // mappingKey -> { cutoffs: [], seats: [] }
            manifest: []
        };

        for (const collName of COLLECTIONS) {
            console.log(`Analyzing ${collName}...`);
            const collection = db.collection(collName);
            const cursor = collection.find({});
            const total = await collection.countDocuments({});
            
            let processed = 0;
            while (await cursor.hasNext()) {
                const doc = await cursor.next();
                processed++;
                if (processed % 5000 === 0) process.stdout.write('.');

                const oldId = doc.institution_id;
                if (!oldId) continue;

                const newId = identityEnforcement.resolveCanonicalId(doc.institute_name_raw || oldId);
                
                if (oldId !== newId) {
                    // Track Mapping
                    if (!auditData.mappings[oldId]) auditData.mappings[oldId] = {};
                    if (!auditData.mappings[oldId][newId]) auditData.mappings[oldId][newId] = 0;
                    auditData.mappings[oldId][newId]++;

                    // Track Samples
                    const mKey = `${oldId}->${newId}`;
                    if (!auditData.samples[mKey]) auditData.samples[mKey] = { engineering_cutoffs: [], seat_matrix: [] };
                    if (auditData.samples[mKey][collName].length < 5) {
                        auditData.samples[mKey][collName].push(doc);
                    }

                    // Add to Manifest
                    auditData.manifest.push({
                        collection: collName,
                        _id: doc._id,
                        old_institution_id: oldId,
                        new_institution_id: newId,
                        institute_name_raw: doc.institute_name_raw
                    });

                    // Potential Conflict Check (Is newId already used by OTHER records?)
                    if (!auditData.conflicts[newId]) {
                        auditData.conflicts[newId] = { existing: 0, incoming: 0 };
                    }
                    auditData.conflicts[newId].incoming++;
                }
            }
            console.log(`\nFinished ${collName}.`);
        }

        // Second pass: Count existing records for target IDs
        console.log("Validating conflicts against existing canonical records...");
        for (const newId of Object.keys(auditData.conflicts)) {
            for (const collName of COLLECTIONS) {
                const existingCount = await db.collection(collName).countDocuments({ 
                    institution_id: newId 
                });
                auditData.conflicts[newId].existing += existingCount;
            }
        }

        // Generate Report
        generateReport(auditData);
        
        // Save Manifest
        if (!fs.existsSync(path.dirname(MANIFEST_PATH))) fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(auditData.manifest, null, 2));

        console.log(`\n✅ Audit Complete.`);
        console.log(`Report: ${REPORT_PATH}`);
        console.log(`Manifest: ${MANIFEST_PATH}`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Audit Failed:", err);
        process.exit(1);
    }
}

function generateReport(data) {
    let md = `# Identity Enforcement Migration Audit\n\n`;
    md += `**Date:** ${new Date().toISOString()}\n`;
    md += `**Total Changes:** ${data.manifest.length}\n\n`;

    md += `## 1. Mapping Summary\n\n`;
    md += `| Old ID | New Canonical ID | Count | Safety |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;

    for (const oldId in data.mappings) {
        for (const newId in data.mappings[oldId]) {
            const count = data.mappings[oldId][newId];
            const conflict = data.conflicts[newId];
            let safety = "SAFE";
            if (conflict.existing > 0) safety = "REVIEW (Merge)";
            
            md += `| ${oldId} | ${newId} | ${count} | ${safety} |\n`;
        }
    }

    md += `\n## 2. Conflict Report\n\n`;
    md += `| Target ID | Existing Records | Incoming Records | Status |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;

    for (const newId in data.conflicts) {
        const c = data.conflicts[newId];
        if (c.existing > 0) {
            md += `| ${newId} | ${c.existing} | ${c.incoming} | REVIEW |\n`;
        }
    }

    md += `\n## 3. Sample Mappings\n\n`;
    for (const mKey in data.samples) {
        const [oldId, newId] = mKey.split('->');
        md += `### ${oldId} → ${newId}\n\n`;
        
        if (data.samples[mKey].engineering_cutoffs.length > 0) {
            md += `**Engineering Cutoffs Samples:**\n`;
            data.samples[mKey].engineering_cutoffs.forEach(s => {
                md += `- ${s.institute_name_raw} (Category: ${s.category}, Branch: ${s.branch_name_raw})\n`;
            });
        }
        
        if (data.samples[mKey].seat_matrix.length > 0) {
            md += `**Seat Matrix Samples:**\n`;
            data.samples[mKey].seat_matrix.forEach(s => {
                md += `- ${s.institute_name_raw} (Seat Pool: ${s.seat_pool}, Intake: ${s.total_includes_female_supernumerary})\n`;
            });
        }
        md += `\n---\n`;
    }

    md += `\n## 4. Rollback Manifest\n\n`;
    md += `Rollback manifest saved at: \`${MANIFEST_PATH}\`\n`;

    fs.writeFileSync(REPORT_PATH, md);
}

runAudit();
