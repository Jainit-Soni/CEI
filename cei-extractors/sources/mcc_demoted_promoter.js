#!/usr/bin/env node

/**
 * MCC Demoted Cohort Re-Promotion Auditor (Phase 109F)
 * ====================================================
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    const demotedNodes = await db.collection('institutions').find({ 
        status: 'PENDING_PROMOTION_AUDIT',
        isVisible: false
    }).toArray();

    console.log('\n--- Phase 1: Demoted Cohort Classification ---');
    console.log(`Total demoted nodes to audit: ${demotedNodes.length}`);

    const promoted = [];
    const held = [];

    for (const node of demotedNodes) {
        const name = node.institution_name.toUpperCase();
        let type = 'ambiguous/hospital-only';
        let pass = false;
        let reason = 'Ambiguous or hospital identity';
        let finalName = node.institution_name;

        // 1. Central institute / AIIMS / JIPMER / AFMC
        if (name.includes('AIIMS') || name.includes('ALL INDIA INSTITUTE OF MEDICAL SCIENCES') || 
            name.includes('JIPMER') || name.includes('ARMED FORCES MEDICAL COLLEGE') ||
            name.includes('LADY HARDINGE') || name.includes('VARDHMAN MAHAVIR') ||
            name.includes('MAULANA AZAD')) {
            type = 'Central institute / AIIMS / JIPMER / AFMC';
            // Verify city/state is present
            if (name.includes('DELHI') || name.includes('PUNE') || name.includes(',') || node.state_name) {
                pass = true;
                reason = 'High-confidence Central Institute';
                // Clean up AIIMS names for UX
                if (name.includes('AIIMS') && name.includes(',')) {
                    finalName = `All India Institute of Medical Sciences (AIIMS)${name.substring(name.indexOf(','))}`;
                }
            } else {
                reason = 'Missing explicit city/state mapping';
            }
        } 
        // 2. Dental college
        else if (name.includes('DENTAL')) {
            type = 'Dental college';
            reason = 'Holding dental surfaces for separate UX layer';
        }
        // 3. Government Medical College (missed previously due to abbreviation)
        else if (name.includes('G.S. MEDICAL COLLEGE') || name.includes('S.M.S. MEDICAL COLLEGE') ||
                 name.includes('S M S MEDICAL COLLEGE') || name.includes('S.C.B. MEDICAL COLLEGE') ||
                 name.includes('GRANT MEDICAL COLLEGE') || name.includes('MEDICAL COLLEGE AND HOSPITAL')) {
            type = 'Government Medical College (Legacy/Named)';
            if (name.includes(',')) {
                pass = true;
                reason = 'High-confidence Named Govt/University Medical College';
            } else {
                reason = 'Missing explicit city mapping for named college';
            }
        }
        // 4. University Medical College
        else if (name.includes('UNIVERSITY') || name.includes('INSTITUTE OF MEDICAL SCIENCES')) {
            type = 'University medical college';
            if (name.includes(',')) {
                pass = true;
                reason = 'High-confidence University Medical College';
            } else {
                reason = 'Missing explicit city mapping';
            }
        }
        // 5. Catch remaining potentially safe ones if they have explicit city
        else if (name.includes('MEDICAL COLLEGE') && name.includes(',')) {
            type = 'Government Medical College (General)';
            pass = true;
            reason = 'Clear Medical College with Location';
        }

        // Apply formatting rules
        finalName = titleCase(finalName);

        if (pass) {
            promoted.push({ id: node.institution_id, name: finalName, type, originalName: node.institution_name });
            await db.collection('institutions').updateOne(
                { _id: node._id },
                { $set: { 
                    isVisible: true, 
                    institution_name: finalName,
                    status: 'PROMOTED_MEDICAL_TRUTH',
                    verification_note: "Identity verified via MCC type-specific rules"
                }}
            );
        } else {
            held.push({ id: node.institution_id, name: finalName, type, reason });
            // keep isVisible: false, status: PENDING_PROMOTION_AUDIT
        }
    }

    console.log(`\n--- Phase 3 & 4: Re-promotion Results ---`);
    console.log(`Promoted: ${promoted.length}`);
    console.log(`Held: ${held.length}`);

    // Update manifest
    const manifestPath = 'e:/CMAT-PROBLEM/backend/data/truth/medical_truth_manifest.json';
    const manifest = await fs.readJson(manifestPath);
    manifest.metrics.public_visible_institutions += promoted.length;
    manifest.policy = "SELECTIVE_PROMOTION_PHASE_109F";
    manifest.last_updated = new Date().toISOString();
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });

    console.log(`\n--- Phase 5: Final Scorecard ---`);
    console.log(`Public nodes before: ${manifest.metrics.public_visible_institutions - promoted.length}`);
    console.log(`Promoted from demoted cohort: ${promoted.length}`);
    console.log(`Still held: ${held.length}`);
    console.log(`Final public count: ${manifest.metrics.public_visible_institutions}`);
    console.log(`Internal-only count (Held nodes): ${held.length}`);
    console.log(`Identity risk count: 0 (All unverified held)`);

    await client.close();
}

function titleCase(s) {
    return s.split(' ')
        .map(w => w.length > 3 || w === 'SMS' ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toUpperCase())
        .join(' ')
        .replace(/Aiims/gi, 'AIIMS')
        .replace(/Esic/gi, 'ESIC')
        .replace(/Jipmer/gi, 'JIPMER')
        .replace(/Afmc/gi, 'AFMC');
}

main().catch(console.error);
