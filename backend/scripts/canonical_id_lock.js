/**
 * canonical_id_lock.js — CEI Canonical ID Lock & Merge System (V2)
 *
 * Goal: Ensure 1 institution = 1 canonical ID across entire system.
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

function normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

async function run() {
    console.log('🚀 Starting Canonical ID Lock System (V2)...');
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;

    console.log('🔍 Scanning for duplicates...');
    const institutions = await db.collection('institutions').find({}).toArray();
    
    const nameStateMap = new Map(); 
    const aisheMap = new Map();

    institutions.forEach(inst => {
        const name = inst.name || inst.institution_name;
        if (!name) return; // SKIP empty names, do not merge

        const nn = normalizeName(name);
        if (!nn) return; // SKIP if name normalizes to empty

        const state = inst.state ? inst.state.toLowerCase() : 'unknown';
        const key = `${nn}|${state}`;
        
        if (!nameStateMap.has(key)) nameStateMap.set(key, []);
        nameStateMap.get(key).push(inst);

        if (inst.aisheId) {
            if (!aisheMap.has(inst.aisheId)) aisheMap.set(inst.aisheId, []);
            aisheMap.get(inst.aisheId).push(inst);
        }
    });

    const duplicateGroups = [];
    for (const [key, list] of nameStateMap.entries()) {
        if (list.length > 1) {
            // Check if they are actually DIFFERENT institutions
            // If they have different AISHE codes but same name+state, they might be different campuses.
            // But if one has AISHE and other doesn't, we merge.
            duplicateGroups.push({ type: 'name_state', key, institutions: list });
        }
    }

    for (const [aishe, list] of aisheMap.entries()) {
        if (list.length > 1) {
            const alreadyGrouped = duplicateGroups.some(g => g.institutions.some(i => i.aisheId === aishe));
            if (!alreadyGrouped) {
                duplicateGroups.push({ type: 'aishe', key: aishe, institutions: list });
            }
        }
    }

    // FILTER OUT the massive "unknown" bucket if it accidentally happened again
    const safeGroups = duplicateGroups.filter(g => {
        if (g.institutions.length > 10) {
            console.warn(`⚠️ Warning: Group ${g.key} has ${g.institutions.length} nodes. Skipping for safety.`);
            return false;
        }
        return true;
    });

    console.log(`📊 Found ${safeGroups.length} safe duplicate groups.`);

    if (safeGroups.length === 0) {
        console.log('✅ No safe duplicates detected.');
        process.exit(0);
    }

    const mergeReport = [];
    for (const group of safeGroups) {
        const sorted = group.institutions.sort((a, b) => {
            const aHasTruth = (a.fees?.isVerified || a.placements?.isVerified) ? 1 : 0;
            const bHasTruth = (b.fees?.isVerified || b.placements?.isVerified) ? 1 : 0;
            if (aHasTruth !== bHasTruth) return bHasTruth - aHasTruth;
            
            const aIsCore = a.institution_id && a.institution_id.startsWith('CORE-') ? 1 : 0;
            const bIsCore = b.institution_id && b.institution_id.startsWith('CORE-') ? 1 : 0;
            if (aIsCore !== bIsCore) return bIsCore - aIsCore;

            return a.institution_id.length - b.institution_id.length;
        });

        const canonical = sorted[0];
        const duplicates = sorted.slice(1);

        const duplicateIds = duplicates.map(d => d.institution_id);
        
        // MIGRATE REFERENCES
        const cutoffUpdate = await db.collection('engineering_cutoffs').updateMany(
            { institution_id: { $in: duplicateIds } },
            { $set: { institution_id: canonical.institution_id } }
        );

        const seatUpdate = await db.collection('seat_matrix').updateMany(
            { institution_id: { $in: duplicateIds } },
            { $set: { institution_id: canonical.institution_id } }
        );

        // Delete duplicates
        const deleteResult = await db.collection('institutions').deleteMany(
            { _id: { $in: duplicates.map(d => d._id) } }
        );

        mergeReport.push({
            canonical: canonical.institution_id,
            merged: duplicateIds,
            nodes_deleted: deleteResult.deletedCount
        });
    }

    fs.writeFileSync(path.join(__dirname, '../data/truth/merge_report_v2.json'), JSON.stringify(mergeReport, null, 2));

    console.log(`Merge complete. Total nodes deleted: ${mergeReport.reduce((acc, r) => acc + r.nodes_deleted, 0)}`);
    process.exit(0);
}

run().catch(console.error);
